use crate::catalog::cache::CatalogCache;
use crate::catalog::incremental::{
    FilesystemIndex, ScanMode, DEFAULT_MAX_DURATION, FORCE_MAX_DURATION,
};
use crate::catalog::scan_settings::ScanSettings;
use crate::catalog::sync::health::SourceOutcome;
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
) -> PortableSources {
    let fixed_roots = settings
        .auto_scan_fixed_drives
        .then(crate::platform::windows::drives::fixed_drive_roots)
        .unwrap_or_default();
    let roots = roots_for(settings, request, fixed_roots);
    let mut excluded = catalog::default_portable_exclusions();
    excluded.extend(settings.excluded_paths.iter().map(PathBuf::from));
    excluded.extend(steam_libraries);
    let mode = if request == SyncRequest::Force {
        ScanMode::Force
    } else {
        ScanMode::Incremental
    };
    let previous_apps = previous
        .sources
        .iter()
        .find(|snapshot| snapshot.key.0 == "portable")
        .map(|snapshot| snapshot.apps.as_slice())
        .unwrap_or_default();
    let started_at = Instant::now();
    let scan = portable::scan_roots(
        portable::PortableScanInput {
            previous_apps,
            previous_index: &previous.filesystem_index,
            roots: &roots.scanned,
            retained_roots: &roots.retained,
            excluded: &excluded,
            mode,
            max_duration: scan_duration(request),
            verify_fingerprints: settings.catalog_portable_fingerprint_v1,
        },
        progress,
        is_cancelled,
    );
    let replaced = scan.stop.is_none();
    let outcome = SourceOutcome {
        key: "portable",
        stop: scan.stop,
        answered: true,
        replaced,
        records: scan.apps.len(),
        duration: started_at.elapsed(),
    };
    PortableSources {
        apps: replaced.then_some(scan.apps),
        filesystem_index: replaced.then_some(scan.filesystem_index),
        outcome,
    }
}

fn scan_duration(request: SyncRequest) -> std::time::Duration {
    if request == SyncRequest::Force {
        FORCE_MAX_DURATION
    } else {
        DEFAULT_MAX_DURATION
    }
}

#[derive(Debug, PartialEq, Eq)]
struct PortableRoots {
    scanned: Vec<PathBuf>,
    retained: Vec<PathBuf>,
}

fn roots_for(
    settings: &ScanSettings,
    request: SyncRequest,
    fixed_roots: Vec<PathBuf>,
) -> PortableRoots {
    let mut scanned = settings
        .included_paths
        .iter()
        .map(PathBuf::from)
        .filter(|path| path.is_dir())
        .collect::<Vec<_>>();
    let mut retained = Vec::new();
    if settings.auto_scan_fixed_drives {
        if request == SyncRequest::Force {
            scanned.extend(fixed_roots);
        } else {
            retained = fixed_roots;
        }
    }
    minimize_roots(&mut scanned);
    minimize_roots(&mut retained);
    PortableRoots { scanned, retained }
}

fn minimize_roots(roots: &mut Vec<PathBuf>) {
    roots.sort_by_cached_key(|path| {
        (
            path.components().count(),
            path.to_string_lossy().to_lowercase(),
        )
    });
    let mut minimized: Vec<PathBuf> = Vec::new();
    for root in roots.drain(..) {
        let key = root.to_string_lossy().to_lowercase();
        if minimized.iter().any(|parent| {
            crate::catalog::path_is_within(&key, &parent.to_string_lossy().to_lowercase())
        }) {
            continue;
        }
        minimized.push(root);
    }
    *roots = minimized;
}

#[cfg(test)]
mod tests {
    use super::*;

    fn settings(auto_scan_fixed_drives: bool, included_paths: Vec<String>) -> ScanSettings {
        ScanSettings {
            auto_scan_fixed_drives,
            included_paths,
            ..ScanSettings::default()
        }
    }

    #[test]
    fn refresh_scans_explicit_roots_and_retains_fixed_drives() {
        let explicit = tempfile::tempdir().unwrap();
        let fixed = PathBuf::from(r"D:\");
        let roots = roots_for(
            &settings(true, vec![explicit.path().to_string_lossy().into_owned()]),
            SyncRequest::Refresh,
            vec![fixed.clone()],
        );

        assert_eq!(roots.scanned, vec![explicit.path().to_path_buf()]);
        assert_eq!(roots.retained, vec![fixed]);
    }

    #[test]
    fn force_scan_removes_an_explicit_root_nested_under_a_fixed_drive() {
        let fixed = tempfile::tempdir().unwrap();
        let explicit = fixed.path().join("Tools");
        std::fs::create_dir_all(&explicit).unwrap();
        let roots = roots_for(
            &settings(true, vec![explicit.to_string_lossy().into_owned()]),
            SyncRequest::Force,
            vec![fixed.path().to_path_buf()],
        );

        assert_eq!(roots.scanned, vec![fixed.path().to_path_buf()]);
        assert!(roots.retained.is_empty());
    }

    #[test]
    fn disabled_fixed_drive_scanning_neither_scans_nor_retains_fixed_drives() {
        let fixed = PathBuf::from(r"D:\");
        let roots = roots_for(
            &settings(false, Vec::new()),
            SyncRequest::Refresh,
            vec![fixed],
        );

        assert!(roots.scanned.is_empty());
        assert!(roots.retained.is_empty());
    }

    #[test]
    fn force_scan_uses_the_short_shared_portable_budget() {
        assert_eq!(scan_duration(SyncRequest::Force), FORCE_MAX_DURATION);
        assert_eq!(scan_duration(SyncRequest::Refresh), DEFAULT_MAX_DURATION);
    }
}
