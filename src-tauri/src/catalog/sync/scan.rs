use super::commit::write_catalog_under_lock;
use super::hydration::enqueue_hydration;
use crate::app_state::AppState;
use crate::catalog::scan_coordinator::{ScanJob, Submission};
use crate::catalog::sync::{CatalogDeltaDto, SyncRequest};
use crate::catalog::AppInfo;
use crate::error::AppError;
use std::sync::mpsc::{Receiver, RecvTimeoutError};
use std::time::{Duration, Instant};
use tauri::{Emitter, Manager};

const WAIT_REPORT_INTERVAL: Duration = Duration::from_secs(5);

#[derive(Clone)]
pub(crate) struct ScanCommit {
    pub apps: Vec<AppInfo>,
    pub generation: u64,
}

fn synchronize_catalog_once(
    app: &tauri::AppHandle,
    job: &ScanJob<ScanCommit>,
) -> Result<ScanCommit, AppError> {
    let _operation = crate::diagnostics::Operation::start("catalog synchronization");
    let outcome = write_catalog_under_lock(app, job).inspect_err(|error| {
        log::error!(
            "Catalog synchronization failed: request={:?} code={} error={error}",
            job.request,
            error.code()
        );
    })?;
    log::info!(
        "Catalog publication: generation={} records={}",
        outcome.generation,
        outcome.apps.len()
    );
    if let Some(diagnostics) = &outcome.diagnostics {
        let _ = app.emit("catalog://diagnostics", diagnostics);
    }
    let summary = &outcome.delta.summary;
    if summary.added + summary.removed + summary.updated > 0 {
        let _ = app.emit("catalog://delta", CatalogDeltaDto::from(&outcome.delta));
        let _ = app.emit("catalog://changed", summary);
    }
    let hydration_ids = if job.request == SyncRequest::Watch {
        outcome
            .delta
            .upserted
            .iter()
            .map(|app| app.id.clone())
            .collect()
    } else {
        outcome.apps.iter().map(|app| app.id.clone()).collect()
    };
    log::info!("Catalog publication: scheduling icon hydration");
    enqueue_hydration(
        app.clone(),
        outcome.app_data_dir,
        outcome.generation,
        hydration_ids,
        false,
    );
    Ok(ScanCommit {
        apps: outcome.apps,
        generation: outcome.generation,
    })
}

fn synchronize_catalog_guarded(
    app: &tauri::AppHandle,
    job: &ScanJob<ScanCommit>,
) -> Result<ScanCommit, AppError> {
    super::scan_guard::guarded("catalog synchronization", || {
        synchronize_catalog_once(app, job)
    })
}

fn await_scan_result(
    request: SyncRequest,
    receiver: Receiver<Result<ScanCommit, AppError>>,
) -> Result<ScanCommit, AppError> {
    let waiting_since = Instant::now();
    loop {
        match receiver.recv_timeout(WAIT_REPORT_INTERVAL) {
            Ok(result) => {
                log::info!(
                    "Scan result received: request={request:?} waitedMs={}",
                    waiting_since.elapsed().as_millis()
                );
                return result;
            }
            Err(RecvTimeoutError::Timeout) => log::warn!(
                "Scan result still pending after {}s: request={request:?}",
                waiting_since.elapsed().as_secs()
            ),
            Err(RecvTimeoutError::Disconnected) => {
                log::error!(
                    "Scan result was never delivered: request={request:?} waitedMs={}",
                    waiting_since.elapsed().as_millis()
                );
                return Err(AppError::Interrupted {
                    context: "Application scan result",
                    source: "the scan finished without answering this request".into(),
                });
            }
        }
    }
}

pub(crate) fn run_coordinated_scan(
    app: &tauri::AppHandle,
    request: SyncRequest,
    wants_result: bool,
) -> Result<Option<ScanCommit>, AppError> {
    let state = app.state::<AppState>();
    let coordinator = &state.scan_coordinator;
    let _operation = crate::diagnostics::Operation::start("coordinated scan request");
    log::info!("Scan submitted: request={request:?} wantsResult={wants_result}");
    match coordinator.submit(request, wants_result) {
        Submission::Start { job, receiver } => {
            log::info!("Scan submission started: request={request:?}");
            if let Some(receiver) = receiver {
                let result = synchronize_catalog_guarded(app, &job);
                if let Some(next) = coordinator.complete(job, result) {
                    let handle = app.clone();
                    tauri::async_runtime::spawn_blocking(move || {
                        process_scan_chain(&handle, next);
                    });
                }
                await_scan_result(request, receiver).map(Some)
            } else {
                process_scan_chain(app, job);
                Ok(None)
            }
        }
        Submission::Wait(receiver) => {
            log::info!("Scan submission waiting: request={request:?}");
            await_scan_result(request, receiver).map(Some)
        }
        Submission::Coalesced => {
            log::info!("Scan submission coalesced: request={request:?}");
            Ok(None)
        }
    }
}

fn process_scan_chain(app: &tauri::AppHandle, mut job: ScanJob<ScanCommit>) {
    let state = app.state::<AppState>();
    loop {
        let result = synchronize_catalog_guarded(app, &job);
        let Some(next) = state.scan_coordinator.complete(job, result) else {
            break;
        };
        job = next;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;

    fn commit() -> ScanCommit {
        ScanCommit {
            apps: Vec::new(),
            generation: 7,
        }
    }

    #[test]
    fn a_delivered_result_is_returned_to_the_caller() {
        let (sender, receiver) = mpsc::channel();
        sender.send(Ok(commit())).expect("the receiver is alive");

        let result = await_scan_result(SyncRequest::Refresh, receiver);

        assert_eq!(result.map(|commit| commit.generation).ok(), Some(7));
    }

    #[test]
    fn a_waiter_the_coordinator_dropped_reports_an_interruption_instead_of_waiting_forever() {
        let (sender, receiver) = mpsc::channel::<Result<ScanCommit, AppError>>();
        drop(sender);

        let result = await_scan_result(SyncRequest::Refresh, receiver);

        assert_eq!(
            result.err().map(|error| error.code()),
            Some("OPERATION_INTERRUPTED")
        );
    }
}
