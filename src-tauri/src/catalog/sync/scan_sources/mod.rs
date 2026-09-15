mod installer_sources;
mod portable_sources;
mod selection;
mod stage_log;
mod steam_sources;
mod windows_sources;

use crate::catalog::cache::CatalogCache;
use crate::catalog::incremental::FilesystemIndex;
use crate::catalog::scan_settings::ScanSettings;
use crate::catalog::source::{SourceKey, SourceSnapshot};
use crate::catalog::sources::registry::RegistryMetadata;
use crate::catalog::sync::health::SourceOutcome;
use crate::catalog::sync::scan_control::ScanControl;
use crate::catalog::sync::scan_steps::StepTracker;
use crate::catalog::sync::SyncRequest;
use crate::catalog::volumes::TrackedVolume;
use crate::catalog::{self, ScanProgress};
use selection::ScanSelection;

pub(super) struct SourceScan {
    pub updates: Vec<SourceSnapshot>,
    pub outcomes: Vec<SourceOutcome>,
    pub registry_metadata: Option<Vec<RegistryMetadata>>,
    pub filesystem_index: Option<FilesystemIndex>,
    pub volumes: Option<Vec<TrackedVolume>>,
    pub unreachable_folders: usize,
}

pub(super) fn scan_all(
    previous: &CatalogCache,
    settings: &ScanSettings,
    request: SyncRequest,
    progress: &impl Fn(ScanProgress),
    is_cancelled: &(impl Fn() -> bool + Sync),
    steps: &StepTracker,
) -> SourceScan {
    let control = ScanControl::with_steps(is_cancelled, steps.clone());
    let selection = ScanSelection::for_request(request);
    log::info!(
        "Scan starting: request={request:?} fixedDrives={} includedPaths={} excludedPaths={}",
        settings.auto_scan_fixed_drives,
        settings.included_paths.len(),
        settings.excluded_paths.len()
    );
    if selection.registry || selection.start_menu || selection.start_apps {
        progress(ScanProgress {
            stage: "Windows applications".into(),
            location: None,
            completed_roots: 0,
            total_roots: 0,
        });
    }

    let windows = windows_sources::scan(&control, &selection);
    let installers = selection
        .installer
        .then(|| installer_sources::scan(&control, progress));
    let steam = selection
        .steam
        .then(|| steam_sources::scan(progress, is_cancelled, steps));
    let steam_libraries = steam.as_ref().map_or_else(
        || {
            selection
                .portable
                .then(catalog::steam::installed_libraries)
                .unwrap_or_default()
        },
        |scan| scan.libraries.clone(),
    );
    let portable = selection.portable.then(|| {
        portable_sources::scan(
            previous,
            settings,
            request,
            steam_libraries,
            progress,
            is_cancelled,
            steps,
        )
    });

    let windows_sources::WindowsSources {
        registry,
        registry_metadata,
        start_menu,
        start_apps,
        mut outcomes,
    } = windows;

    let mut updates = Vec::new();
    if let Some(installers) = installers {
        outcomes.push(installers.outcome);
        push_snapshot(
            &mut updates,
            catalog::source::INSTALLER_CACHE_SOURCE,
            installers.apps,
        );
    }
    if let Some(steam) = steam {
        outcomes.push(steam.outcome);
        push_snapshot(&mut updates, "steam", steam.apps);
    }
    let mut filesystem_index = None;
    let mut volumes = None;
    let mut unreachable_folders = 0;
    if let Some(portable) = portable {
        outcomes.push(portable.outcome);
        filesystem_index = portable.filesystem_index;
        volumes = portable.volumes;
        unreachable_folders = portable.unreachable_folders;
        push_snapshot(&mut updates, "portable", portable.apps);
    }
    push_snapshot(&mut updates, catalog::source::REGISTRY_SOURCE, registry);
    push_snapshot(&mut updates, catalog::source::START_MENU_SOURCE, start_menu);
    push_snapshot(&mut updates, catalog::source::START_APPS_SOURCE, start_apps);

    SourceScan {
        updates,
        outcomes,
        registry_metadata,
        filesystem_index,
        volumes,
        unreachable_folders,
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
