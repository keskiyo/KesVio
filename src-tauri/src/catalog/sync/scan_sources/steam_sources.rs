use super::stage_log;
use crate::catalog::sync::health::SourceOutcome;
use crate::catalog::sync::scan_control::StageStop;
use crate::catalog::sync::scan_steps::StepTracker;
use crate::catalog::{self, AppInfo, ScanProgress};
use std::path::PathBuf;
use std::time::Instant;

pub(super) struct SteamSources {
    pub apps: Option<Vec<AppInfo>>,
    pub libraries: Vec<PathBuf>,
    pub outcome: SourceOutcome,
}

pub(super) fn scan(
    progress: &impl Fn(ScanProgress),
    is_cancelled: &(impl Fn() -> bool + Sync),
    steps: &StepTracker,
) -> SteamSources {
    stage_log::starting("steam");
    steps.mark("steam", "installed libraries");
    let started_at = Instant::now();
    let libraries = catalog::steam::installed_libraries();
    let mut apps = Vec::new();
    let mut cancelled = false;
    let mut complete = true;
    progress(ScanProgress {
        stage: "Steam libraries".into(),
        location: None,
        completed_roots: 0,
        total_roots: libraries.len(),
    });
    for (index, library) in libraries.iter().enumerate() {
        if is_cancelled() {
            cancelled = true;
            break;
        }
        steps.mark("steam", &library.to_string_lossy());
        let scan = catalog::steam::scan_library(library);
        complete &= scan.complete;
        apps.extend(scan.games.into_iter().map(catalog::steam_app));
        progress(ScanProgress {
            stage: "Steam libraries".into(),
            location: Some(library.to_string_lossy().into_owned()),
            completed_roots: index + 1,
            total_roots: libraries.len(),
        });
    }
    let replaced = !cancelled && complete;
    let outcome = SourceOutcome {
        key: "steam",
        stop: cancelled.then_some(StageStop::Cancelled),
        answered: complete,
        replaced,
        records: apps.len(),
        duration: started_at.elapsed(),
    };
    stage_log::finished(&outcome);
    SteamSources {
        apps: replaced.then_some(apps),
        libraries,
        outcome,
    }
}
