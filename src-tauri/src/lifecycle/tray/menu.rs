use serde::Deserialize;
use tauri::menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::AppHandle;

pub(crate) const MAX_TRAY_SCENARIOS: usize = 5;
pub(crate) const MAX_SCENARIO_ID_CHARS: usize = 512;

const SCENARIO_PREFIX: &str = "scenario:";
const MAX_LABEL_CHARS: usize = 40;
const FALLBACK_LABEL: &str = "Scenario";
const FAVORITE_MARK: &str = "★ ";
const PLAIN_MARK: &str = "☆ ";

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TrayScenario {
    pub(crate) id: String,
    pub(crate) label: String,
    #[serde(default)]
    pub(crate) favorite: bool,
}

#[derive(Debug, Eq, PartialEq)]
pub(super) enum TrayAction {
    Open,
    Quit,
    ForceFullScan,
    RunScenario(String),
}

pub(super) fn tray_action(id: &str) -> Option<TrayAction> {
    match id {
        "open" => Some(TrayAction::Open),
        "quit" => Some(TrayAction::Quit),
        super::scan::FORCE_SCAN_ID => Some(TrayAction::ForceFullScan),
        _ => id
            .strip_prefix(SCENARIO_PREFIX)
            .filter(|scenario| {
                !scenario.is_empty() && scenario.chars().count() <= MAX_SCENARIO_ID_CHARS
            })
            .map(|scenario| TrayAction::RunScenario(scenario.to_owned())),
    }
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

pub(super) fn build_menu(
    app: &AppHandle,
    scenarios: &[TrayScenario],
    scan: &MenuItem<tauri::Wry>,
) -> tauri::Result<Menu<tauri::Wry>> {
    let open = MenuItem::with_id(app, "open", "Open KesVio", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    if scenarios.is_empty() {
        return Menu::with_items(app, &[&open, scan, &separator, &quit]);
    }
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
    let submenu = Submenu::with_items(app, "Scenarios", true, &references)?;
    let scenario_separator = PredefinedMenuItem::separator(app)?;
    Menu::with_items(
        app,
        &[
            &open,
            scan,
            &scenario_separator,
            &submenu,
            &separator,
            &quit,
        ],
    )
}

#[cfg(test)]
mod tests;
