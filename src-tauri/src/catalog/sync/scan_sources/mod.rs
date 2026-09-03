mod installer_sources;
mod portable_sources;
mod steam_sources;
mod windows_sources;

use crate::catalog::cache::CatalogCache;
use crate::catalog::incremental::FilesystemIndex;
use crate::catalog::scan_settings::ScanSettings;
use crate::catalog::source::{SourceKey, SourceSnapshot};
use crate::catalog::sources::registry::RegistryMetadata;
use crate::catalog::sync::health::SourceOutcome;
use crate::catalog::sync::scan_control::ScanControl;
use crate::catalog::sync::SyncRequest;
use crate::catalog::{self, ScanProgress};

pub(super) struct SourceScan {
    pub updates: Vec<SourceSnapshot>,
    pub outcomes: Vec<SourceOutcome>,
    pub registry_metadata: Option<Vec<RegistryMetadata>>,
    pub filesystem_index: Option<FilesystemIndex>,
}

pub(super) fn scan_all(
    previous: &CatalogCache,
    settings: &ScanSettings,
    request: SyncRequest,
    progress: &impl Fn(ScanProgress),
    is_cancelled: &(impl Fn() -> bool + Sync),
) -> SourceScan {
    let control = ScanControl::new(is_cancelled);
    log::info!(
        "Scan starting: request={request:?} fixedDrives={} includedPaths={} excludedPaths={}",
        settings.auto_scan_fixed_drives,
        settings.included_paths.len(),
        settings.excluded_paths.len()
    );
    progress(ScanProgress {
        stage: "Windows applications".into(),
        location: None,
        completed_roots: 0,
        total_roots: 0,
    });

    let windows = windows_sources::scan(&control);
    let installers = installer_sources::scan(&control, progress);
    let steam = steam_sources::scan(progress, is_cancelled);
    let portable = portable_sources::scan(
        previous,
        settings,
        request,
        steam.libraries,
        progress,
        is_cancelled,
    );

    let mut outcomes = windows.outcomes;
    outcomes.push(installers.outcome);
    outcomes.push(steam.outcome);
    outcomes.push(portable.outcome);
    for outcome in &outcomes {
        log::info!(
            "Source {} answered={} replaced={} records={} in {}ms stop={:?}",
            outcome.key,
            outcome.answered,
            outcome.replaced,
            outcome.records,
            outcome.duration.as_millis(),
            outcome.stop
        );
    }

    let mut updates = Vec::new();
    push_snapshot(&mut updates, "steam", steam.apps);
    push_snapshot(&mut updates, "portable", portable.apps);
    push_snapshot(
        &mut updates,
        catalog::source::REGISTRY_SOURCE,
        windows.registry,
    );
    push_snapshot(
        &mut updates,
        catalog::source::START_MENU_SOURCE,
        windows.start_menu,
    );
    push_snapshot(
        &mut updates,
        catalog::source::START_APPS_SOURCE,
        windows.start_apps,
    );
    push_snapshot(
        &mut updates,
        catalog::source::INSTALLER_CACHE_SOURCE,
        installers.apps,
    );

    SourceScan {
        updates,
        outcomes,
        registry_metadata: windows.registry_metadata,
        filesystem_index: portable.filesystem_index,
    }
}

fn push_snapshot(
    updates: &mut Vec<SourceSnapshot>,
    key: &str,
    apps: Option<Vec<catalog::AppInfo>>,
) {
    let Some(apps) = apps else {
        return;
    };
    updates.push(SourceSnapshot {
        key: SourceKey(key.into()),
        fingerprint: None,
        health: None,
        apps,
    });
}
