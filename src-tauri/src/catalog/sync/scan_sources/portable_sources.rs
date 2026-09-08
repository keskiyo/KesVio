mod roots;
use roots::roots_for;

use super::stage_log;
use crate::catalog::cache::CatalogCache;
use crate::catalog::incremental::{FilesystemIndex, ScanMode, DEFAULT_MAX_DURATION};
use crate::catalog::scan_settings::ScanSettings;
use crate::catalog::sync::health::SourceOutcome;
use crate::catalog::sync::scan_control::StageStop;
use crate::catalog::sync::scan_steps::StepTracker;
use crate::catalog::sync::{portable, SyncRequest};
use crate::catalog::{self, AppInfo, ScanProgress};
use std::path::PathBuf;
use std::time::Instant;

pub(super) struct PortableSources {
    pub apps: Option<Vec<AppInfo>>,
    pub filesystem_index: Option<FilesystemIndex>,
    pub outcome: SourceOutcome,
}

pub(super) fn scan(
    previous: &CatalogCache,
    settings: &ScanSettings,
    request: SyncRequest,
    steam_libraries: Vec<PathBuf>,
    progress: &impl Fn(ScanProgress),
    is_cancelled: &(impl Fn() -> bool + Sync),
    steps: &StepTracker,
) -> PortableSources {
    stage_log::starting("portable");
    steps.mark("portable", "fixed drives");
    let fixed_roots = settings
        .auto_scan_fixed_drives
        .then(crate::platform::windows::drives::fixed_drive_roots)
        .unwrap_or_default();
    log::info!(
        "Fixed drives enumerated: {}",
        fixed_roots
            .iter()
            .map(|root| root.display().to_string())
            .collect::<Vec<_>>()
            .join(", ")
    );
    let previous_apps = previous
        .sources
        .iter()
        .find(|snapshot| snapshot.key.0 == "portable")
        .map(|snapshot| snapshot.apps.as_slice())
        .unwrap_or_default();
    let roots = roots_for(settings, request, fixed_roots, previous_apps, |path| {
        path.is_dir()
    });
    log::info!(
        "Portable root coverage: scanned={} retained={} previousRecords={}",
        roots.scanned.len(),
        roots.retained.len(),
        previous_apps.len()
    );
    let mut excluded = catalog::default_portable_exclusions();
    excluded.extend(settings.excluded_paths.iter().map(PathBuf::from));
    excluded.extend(steam_libraries);
    let mode = if request == SyncRequest::Force {
        ScanMode::Force
    } else {
        ScanMode::Incremental
    };
    let started_at = Instant::now();
    let scan = portable::scan_roots(
        portable::PortableScanInput {
            previous_apps,
            previous_index: &previous.filesystem_index,
            roots: &roots.scanned,
            retained_roots: &roots.retained,
            excluded: &excluded,
            mode,
            max_duration: DEFAULT_MAX_DURATION,
            verify_fingerprints: settings.catalog_portable_fingerprint_v1,
            steps,
        },
        progress,
        is_cancelled,
    );
    let replaced = adopts_results(scan.stop);
    let outcome = SourceOutcome {
        key: "portable",
        stop: scan.stop,
        answered: true,
        replaced,
        records: scan.apps.len(),
        duration: started_at.elapsed(),
    };
    stage_log::finished(&outcome);
    PortableSources {
        apps: replaced.then_some(scan.apps),
        filesystem_index: replaced.then_some(scan.filesystem_index),
        outcome,
    }
}

fn adopts_results(stop: Option<StageStop>) -> bool {
    !matches!(stop, Some(StageStop::Cancelled))
}

#[cfg(test)]
mod tests;
