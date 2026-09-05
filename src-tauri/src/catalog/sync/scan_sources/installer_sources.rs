use super::stage_log;
use crate::catalog::sync::health::SourceOutcome;
use crate::catalog::sync::scan_control::ScanControl;
use crate::catalog::{self, AppInfo, ScanProgress};
use std::time::Instant;

pub(super) struct InstallerSources {
    pub apps: Option<Vec<AppInfo>>,
    pub outcome: SourceOutcome,
}

pub(super) fn scan(control: &ScanControl, progress: &impl Fn(ScanProgress)) -> InstallerSources {
    stage_log::starting(catalog::source::INSTALLER_CACHE_SOURCE);
    let roots = catalog::installer_cache::roots();
    progress(ScanProgress {
        stage: "Installer caches".into(),
        location: None,
        completed_roots: 0,
        total_roots: roots.len(),
    });
    let budget = control.stage_with(
        catalog::installer_cache::MAX_DURATION,
        catalog::installer_cache::MAX_ENTRIES,
        catalog::installer_cache::MAX_DEPTH,
    );
    let started_at = Instant::now();
    let scan = catalog::installer_cache::scan_roots(&roots, &budget);
    let outcome = SourceOutcome {
        key: catalog::source::INSTALLER_CACHE_SOURCE,
        stop: scan.stop,
        answered: true,
        replaced: scan.stop.is_none(),
        records: scan.apps.len(),
        duration: started_at.elapsed(),
    };
    stage_log::finished(&outcome);
    progress(ScanProgress {
        stage: "Installer caches".into(),
        location: None,
        completed_roots: roots.len(),
        total_roots: roots.len(),
    });
    InstallerSources {
        apps: scan.stop.is_none().then_some(scan.apps),
        outcome,
    }
}
