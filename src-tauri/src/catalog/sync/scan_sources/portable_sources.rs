use crate::catalog::cache::CatalogCache;
use crate::catalog::incremental::{FilesystemIndex, ScanMode, DEFAULT_MAX_DURATION};
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
    let roots = scan_roots(settings);
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
            roots: &roots,
            excluded: &excluded,
            mode,
            max_duration: DEFAULT_MAX_DURATION,
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

fn scan_roots(settings: &ScanSettings) -> Vec<PathBuf> {
    let mut roots = if settings.auto_scan_fixed_drives {
        crate::platform::windows::drives::fixed_drive_roots()
    } else {
        Vec::new()
    };
    roots.extend(
        settings
            .included_paths
            .iter()
            .map(PathBuf::from)
            .filter(|path| path.is_dir()),
    );
    roots.sort_by_cached_key(|path| path.to_string_lossy().to_lowercase());
    roots.dedup_by(|left, right| {
        left.to_string_lossy()
            .eq_ignore_ascii_case(&right.to_string_lossy())
    });
    roots
}
