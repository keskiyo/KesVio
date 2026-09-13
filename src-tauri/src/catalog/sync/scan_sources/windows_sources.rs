use super::selection::ScanSelection;
use super::stage_log;
use crate::catalog::sources::registry::RegistryMetadata;
use crate::catalog::sync::health::SourceOutcome;
use crate::catalog::sync::scan_control::{ScanControl, StageStop};
use crate::catalog::{self, AppInfo};
use std::time::Instant;

pub(super) struct WindowsSources {
    pub registry: Option<Vec<AppInfo>>,
    pub registry_metadata: Option<Vec<RegistryMetadata>>,
    pub start_menu: Option<Vec<AppInfo>>,
    pub start_apps: Option<Vec<AppInfo>>,
    pub outcomes: Vec<SourceOutcome>,
}

pub(super) fn scan(control: &ScanControl, selection: &ScanSelection) -> WindowsSources {
    let mut outcomes = Vec::new();
    let mut registry_apps = None;
    let mut registry_metadata = None;
    let mut start_menu_apps = None;
    let mut start_apps_result = None;

    if selection.registry {
        stage_log::starting(catalog::source::REGISTRY_SOURCE);
        let registry_at = Instant::now();
        let registry = catalog::scan_registry(control);
        let registry_replaced = registry.stop.is_none() && registry.complete;
        record(
            &mut outcomes,
            SourceOutcome {
                key: catalog::source::REGISTRY_SOURCE,
                stop: registry.stop,
                answered: registry.complete,
                replaced: registry_replaced,
                records: registry.apps.len(),
                duration: registry_at.elapsed(),
            },
        );
        if registry_replaced {
            registry_metadata = Some(registry.metadata);
            registry_apps = Some(registry.apps);
        }
    }

    if selection.start_menu {
        stage_log::starting(catalog::source::START_MENU_SOURCE);
        let start_menu_at = Instant::now();
        let start_menu = catalog::scan_start_menu(control);
        let start_menu_replaced = start_menu.stop.is_none() && start_menu.complete;
        record(
            &mut outcomes,
            SourceOutcome {
                key: catalog::source::START_MENU_SOURCE,
                stop: start_menu.stop,
                answered: start_menu.complete,
                replaced: start_menu_replaced,
                records: start_menu.apps.len(),
                duration: start_menu_at.elapsed(),
            },
        );
        if start_menu_replaced {
            start_menu_apps = Some(start_menu.apps);
        }
    }

    if selection.start_apps {
        stage_log::starting(catalog::source::START_APPS_SOURCE);
        let start_apps_at = Instant::now();
        let start_apps = catalog::start_apps::scan(control);
        record(
            &mut outcomes,
            SourceOutcome {
                key: catalog::source::START_APPS_SOURCE,
                stop: (start_apps.is_none() && control.is_cancelled())
                    .then_some(StageStop::Cancelled),
                answered: start_apps.is_some(),
                replaced: start_apps.is_some(),
                records: start_apps.as_ref().map_or(0, Vec::len),
                duration: start_apps_at.elapsed(),
            },
        );
        start_apps_result = start_apps;
    }

    WindowsSources {
        registry_metadata,
        registry: registry_apps,
        start_menu: start_menu_apps,
        start_apps: start_apps_result,
        outcomes,
    }
}

fn record(outcomes: &mut Vec<SourceOutcome>, outcome: SourceOutcome) {
    stage_log::finished(&outcome);
    outcomes.push(outcome);
}
