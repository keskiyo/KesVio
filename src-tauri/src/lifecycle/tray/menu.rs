use super::model::{TrayModel, MAX_SCENARIO_ID_CHARS};
use tauri::menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::AppHandle;

mod labels;
mod sections;
pub(super) use labels::sanitize_label;
use sections::{favorites_submenu, recent_rows, scenarios_submenu};

const SCENARIO_PREFIX: &str = "scenario:";
const FAVORITE_PREFIX: &str = "favorite:";
const RECENT_PREFIX: &str = "recent:";
pub(super) const SEARCH_ID: &str = "search";
pub(super) const SHOW_FAVORITES_ID: &str = "show-favorites";
pub(super) const OPEN_LABEL: &str = "Open KesVio";
pub(super) const SEARCH_LABEL: &str = "Search";
pub(super) const FAVORITES_LABEL: &str = "Favorite apps";
pub(super) const RECENT_LABEL: &str = "Recent";
const RECENT_HEADER_ID: &str = "recent-header";
pub(super) const SHOW_ALL_FAVORITES_LABEL: &str = "Show all favorites…";
pub(super) const SCENARIOS_LABEL: &str = "Scenarios";
pub(super) const QUIT_LABEL: &str = "Quit";

#[derive(Debug, Eq, PartialEq)]
pub(super) enum TrayAction {
    Open,
    Quit,
    Search,
    ForceFullScan,
    ShowFavorites,
    RunScenario(String),
    LaunchApp(String),
}

pub(super) fn tray_action(id: &str) -> Option<TrayAction> {
    match id {
        "open" => Some(TrayAction::Open),
        "quit" => Some(TrayAction::Quit),
        SEARCH_ID => Some(TrayAction::Search),
        SHOW_FAVORITES_ID => Some(TrayAction::ShowFavorites),
        super::scan::FORCE_SCAN_ID => Some(TrayAction::ForceFullScan),
        _ => {
            if let Some(scenario) = id.strip_prefix(SCENARIO_PREFIX) {
                return usable_id(scenario).map(|id| TrayAction::RunScenario(id.to_owned()));
            }
            let app = id
                .strip_prefix(FAVORITE_PREFIX)
                .or_else(|| id.strip_prefix(RECENT_PREFIX))?;
            usable_id(app).map(|id| TrayAction::LaunchApp(id.to_owned()))
        }
    }
}

fn usable_id(id: &str) -> Option<&str> {
    (!id.is_empty() && id.chars().count() <= MAX_SCENARIO_ID_CHARS).then_some(id)
}

pub(super) fn build_menu(
    app: &AppHandle,
    model: &TrayModel,
    scan: &MenuItem<tauri::Wry>,
) -> tauri::Result<Menu<tauri::Wry>> {
    let mut owned: Vec<Box<dyn IsMenuItem<tauri::Wry>>> = Vec::new();
    owned.push(Box::new(MenuItem::with_id(
        app,
        "open",
        OPEN_LABEL,
        true,
        None::<&str>,
    )?));
    owned.push(Box::new(MenuItem::with_id(
        app,
        SEARCH_ID,
        SEARCH_LABEL,
        true,
        None::<&str>,
    )?));
    if !model.favorites.is_empty() {
        owned.push(Box::new(favorites_submenu(app, model)?));
    }
    if !model.scenarios.is_empty() {
        owned.push(Box::new(scenarios_submenu(app, &model.scenarios)?));
    }
    if !model.recent.is_empty() {
        owned.push(Box::new(PredefinedMenuItem::separator(app)?));
        owned.extend(recent_rows(app, &model.recent)?);
    }
    owned.push(Box::new(PredefinedMenuItem::separator(app)?));
    owned.push(Box::new(scan.clone()));
    owned.push(Box::new(PredefinedMenuItem::separator(app)?));
    owned.push(Box::new(MenuItem::with_id(
        app,
        "quit",
        QUIT_LABEL,
        true,
        None::<&str>,
    )?));
    let references = owned.iter().map(|item| item.as_ref()).collect::<Vec<_>>();
    Menu::with_items(app, &references)
}

#[cfg(test)]
mod tests;
