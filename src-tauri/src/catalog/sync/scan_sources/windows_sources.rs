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

pub(super) fn scan(control: &ScanControl) -> WindowsSources {
    let mut outcomes = Vec::new();

    let registry_at = Instant::now();
    let registry = catalog::scan_registry(control);
    let registry_replaced = registry.stop.is_none() && registry.complete;
    outcomes.push(SourceOutcome {
        key: catalog::source::REGISTRY_SOURCE,
        stop: registry.stop,
        answered: registry.complete,
        replaced: registry_replaced,
        records: registry.apps.len(),
        duration: registry_at.elapsed(),
    });

    let start_menu_at = Instant::now();
    let start_menu = catalog::scan_start_menu(control);
    let start_menu_replaced = start_menu.stop.is_none() && start_menu.complete;
    outcomes.push(SourceOutcome {
        key: catalog::source::START_MENU_SOURCE,
        stop: start_menu.stop,
        answered: start_menu.complete,
        replaced: start_menu_replaced,
        records: start_menu.apps.len(),
        duration: start_menu_at.elapsed(),
    });

    let start_apps_at = Instant::now();
    let start_apps = catalog::start_apps::scan(control);
    outcomes.push(SourceOutcome {
        key: catalog::source::START_APPS_SOURCE,
        stop: (start_apps.is_none() && control.is_cancelled()).then_some(StageStop::Cancelled),
        answered: start_apps.is_some(),
        replaced: start_apps.is_some(),
        records: start_apps.as_ref().map_or(0, Vec::len),
        duration: start_apps_at.elapsed(),
    });

    WindowsSources {
        registry_metadata: registry_replaced.then_some(registry.metadata),
        registry: registry_replaced.then_some(registry.apps),
        start_menu: start_menu_replaced.then_some(start_menu.apps),
        start_apps,
        outcomes,
    }
}
