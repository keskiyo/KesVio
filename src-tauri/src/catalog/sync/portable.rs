use crate::catalog::incremental::{
    scan_root_with_duration, FilesystemIndex, RootScanInput, ScanLimit, ScanMode,
};
use crate::catalog::sync::scan_control::StageStop;
use crate::catalog::sync::scan_steps::StepTracker;
use crate::catalog::{AppInfo, ScanProgress};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

pub(super) struct PortableScanResult {
    pub(super) apps: Vec<AppInfo>,
    pub(super) filesystem_index: FilesystemIndex,
    pub(super) stop: Option<StageStop>,
}

pub(super) struct PortableScanInput<'a> {
    pub(super) previous_apps: &'a [AppInfo],
    pub(super) previous_index: &'a FilesystemIndex,
    pub(super) roots: &'a [PathBuf],
    pub(super) retained_roots: &'a [PathBuf],
    pub(super) excluded: &'a [PathBuf],
    pub(super) mode: ScanMode,
    pub(super) max_duration: Duration,
    pub(super) verify_fingerprints: bool,
    pub(super) steps: &'a StepTracker,
}

pub(super) fn scan_roots(
    input: PortableScanInput<'_>,
    progress: &impl Fn(ScanProgress),
    is_cancelled: &impl Fn() -> bool,
) -> PortableScanResult {
    let started_at = Instant::now();
    let mut apps = input
        .previous_apps
        .iter()
        .filter(|app| {
            path_is_within_any_root(&app.path, input.retained_roots)
                && !path_is_within_any_root(&app.path, input.roots)
                && !path_is_within_any_root(&app.path, input.excluded)
        })
        .map(|app| (app.id.clone(), app.clone()))
        .collect::<BTreeMap<_, _>>();
    let mut filesystem_index = FilesystemIndex::default();
    let mut stop = None;
    progress(ScanProgress {
        stage: "Portable applications".into(),
        location: None,
        completed_roots: 0,
        total_roots: input.roots.len(),
    });
    log::info!(
        "Portable scan starting: {} roots to walk, {} retained, budget {}s",
        input.roots.len(),
        input.retained_roots.len(),
        input.max_duration.as_secs()
    );
    for (index, root) in input.roots.iter().enumerate() {
        if is_cancelled() {
            stop = Some(StageStop::Cancelled);
            break;
        }
        let remaining = input.max_duration.saturating_sub(started_at.elapsed());
        let root_duration = root_duration(remaining, input.roots.len() - index);
        log::info!(
            "Portable root {}/{} entering {} with {}s",
            index + 1,
            input.roots.len(),
            root.display(),
            root_duration.as_secs()
        );
        let root_at = Instant::now();
        let scanned = scan_root_with_duration(
            &RootScanInput {
                root,
                previous: input.previous_index,
                mode: input.mode,
                excluded: input.excluded,
                is_cancelled,
                verify_fingerprints: input.verify_fingerprints,
                steps: input.steps,
            },
            root_duration,
        );
        let root_stop = match scanned.limit_reached {
            Some(ScanLimit::Entries) => Some(StageStop::EntryLimit),
            Some(ScanLimit::Time) => Some(StageStop::TimedOut),
            Some(ScanLimit::Depth) | None => None,
        };
        let cancelled = is_cancelled();
        let complete_root = root_stop.is_none() && !cancelled;
        match scanned.limit_reached {
            Some(limit) => log::warn!(
                "Portable root {} stopped on {} after {}ms with {} applications",
                root.display(),
                limit.message(),
                root_at.elapsed().as_millis(),
                scanned.apps.len()
            ),
            None => log::info!(
                "Portable root {} finished in {}ms with {} applications",
                root.display(),
                root_at.elapsed().as_millis(),
                scanned.apps.len()
            ),
        }
        if stop.is_none() {
            stop = cancelled.then_some(StageStop::Cancelled).or(root_stop);
        }
        for app in merge_root_apps(input.previous_apps, scanned.apps, root, complete_root) {
            apps.insert(app.id.clone(), app);
        }
        filesystem_index.directories.extend(
            merge_root_index(input.previous_index, scanned.index, root, complete_root).directories,
        );
        progress(ScanProgress {
            stage: scanned.limit_reached.map_or_else(
                || "Portable applications".into(),
                |limit| format!("Portable applications · {}", limit.message()),
            ),
            location: Some(root.to_string_lossy().into_owned()),
            completed_roots: index + 1,
            total_roots: input.roots.len(),
        });
        if cancelled {
            break;
        }
    }
    PortableScanResult {
        apps: apps.into_values().collect(),
        filesystem_index,
        stop,
    }
}

fn root_duration(remaining: Duration, roots_remaining: usize) -> Duration {
    remaining / u32::try_from(roots_remaining.max(1)).unwrap_or(u32::MAX)
}

fn merge_root_apps(
    previous: &[AppInfo],
    scanned: Vec<AppInfo>,
    root: &Path,
    complete: bool,
) -> Vec<AppInfo> {
    let mut apps = BTreeMap::new();
    if !complete {
        for app in previous
            .iter()
            .filter(|app| path_is_within_root(&app.path, root))
        {
            apps.insert(app.id.clone(), app.clone());
        }
    }
    for app in scanned {
        apps.insert(app.id.clone(), app);
    }
    apps.into_values().collect()
}

fn merge_root_index(
    previous: &FilesystemIndex,
    scanned: FilesystemIndex,
    root: &Path,
    complete: bool,
) -> FilesystemIndex {
    let mut directories = BTreeMap::new();
    if !complete {
        for (path, record) in previous
            .directories
            .iter()
            .filter(|(path, _)| path_is_within_root(path, root))
        {
            directories.insert(path.clone(), record.clone());
        }
    }
    directories.extend(scanned.directories);
    FilesystemIndex { directories }
}

fn path_is_within_root(path: &str, root: &Path) -> bool {
    let path = path.replace('/', r"\").to_lowercase();
    let root = root.to_string_lossy().replace('/', r"\").to_lowercase();
    crate::catalog::path_is_within(&path, &root)
}

fn path_is_within_any_root(path: &str, roots: &[PathBuf]) -> bool {
    roots.iter().any(|root| path_is_within_root(path, root))
}

#[cfg(test)]
mod tests;
