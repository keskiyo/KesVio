use super::model::{TrayFavorite, TrayModel, TrayScenario, MAX_SCENARIO_ID_CHARS};
use tauri::menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::AppHandle;

const SCENARIO_PREFIX: &str = "scenario:";
const FAVORITE_PREFIX: &str = "favorite:";
pub(super) const SEARCH_ID: &str = "search";
pub(super) const SHOW_FAVORITES_ID: &str = "show-favorites";
const MAX_LABEL_CHARS: usize = 40;
const FALLBACK_LABEL: &str = "Scenario";
const FAVORITE_MARK: &str = "★ ";
const PLAIN_MARK: &str = "☆ ";
pub(super) const OPEN_LABEL: &str = "Open KesVio";
pub(super) const SEARCH_LABEL: &str = "Search";
pub(super) const FAVORITES_LABEL: &str = "Favorite apps";
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
            let favorite = id.strip_prefix(FAVORITE_PREFIX)?;
            usable_id(favorite).map(|id| TrayAction::LaunchApp(id.to_owned()))
        }
    }
}

fn usable_id(id: &str) -> Option<&str> {
    (!id.is_empty() && id.chars().count() <= MAX_SCENARIO_ID_CHARS).then_some(id)
}

pub(super) fn sanitize_label(name: &str) -> String {
    let collapsed = name
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .filter(|character| !character.is_control())
        .collect::<String>();
    let trimmed = if collapsed.chars().count() > MAX_LABEL_CHARS {
        let kept = collapsed
            .chars()
            .take(MAX_LABEL_CHARS - 1)
            .collect::<String>();
        format!("{}…", kept.trim_end())
    } else {
        collapsed
    };
    if trimmed.is_empty() {
        return FALLBACK_LABEL.to_owned();
    }
    trimmed.replace('&', "&&")
}

fn menu_label(scenario: &TrayScenario, marked: bool) -> String {
    let label = sanitize_label(&scenario.label);
    if !marked {
        return label;
    }
    let mark = if scenario.favorite {
        FAVORITE_MARK
    } else {
        PLAIN_MARK
    };
    format!("{mark}{label}")
}

pub(super) fn favorite_labels(favorites: &[TrayFavorite]) -> Vec<String> {
    let labels = favorites
        .iter()
        .map(|favorite| sanitize_label(&favorite.label))
        .collect::<Vec<_>>();
    labels
        .iter()
        .enumerate()
        .map(|(index, label)| {
            let duplicates = labels.iter().filter(|other| *other == label).count();
            if duplicates == 1 {
                return label.clone();
            }
            let position = labels[..index]
                .iter()
                .filter(|other| *other == label)
                .count()
                + 1;
            format!("{label} ({position})")
        })
        .collect()
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

fn favorites_submenu(app: &AppHandle, model: &TrayModel) -> tauri::Result<Submenu<tauri::Wry>> {
    let labels = favorite_labels(&model.favorites);
    let mut entries = model
        .favorites
        .iter()
        .zip(labels)
        .map(|(favorite, label)| {
            MenuItem::with_id(
                app,
                format!("{FAVORITE_PREFIX}{}", favorite.id),
                label,
                true,
                None::<&str>,
            )
        })
        .collect::<tauri::Result<Vec<_>>>()?;
    if model.more_favorites {
        entries.push(MenuItem::with_id(
            app,
            SHOW_FAVORITES_ID,
            SHOW_ALL_FAVORITES_LABEL,
            true,
            None::<&str>,
        )?);
    }
    let references = entries
        .iter()
        .map(|entry| entry as &dyn IsMenuItem<tauri::Wry>)
        .collect::<Vec<_>>();
    Submenu::with_items(app, FAVORITES_LABEL, true, &references)
}

fn scenarios_submenu(
    app: &AppHandle,
    scenarios: &[TrayScenario],
) -> tauri::Result<Submenu<tauri::Wry>> {
    let marked = scenarios.iter().any(|scenario| scenario.favorite);
    let entries = scenarios
        .iter()
        .map(|scenario| {
            MenuItem::with_id(
                app,
                format!("{SCENARIO_PREFIX}{}", scenario.id),
                menu_label(scenario, marked),
                true,
                None::<&str>,
            )
        })
        .collect::<tauri::Result<Vec<_>>>()?;
    let references = entries
        .iter()
        .map(|entry| entry as &dyn IsMenuItem<tauri::Wry>)
        .collect::<Vec<_>>();
    Submenu::with_items(app, SCENARIOS_LABEL, true, &references)
}

#[cfg(test)]
mod tests;
