mod menu;
mod scan;

pub(crate) use scan::apply_state as set_scan_state;
#[cfg(test)]
pub(crate) use scan::FORCE_SCAN_EVENT;

pub(crate) use menu::{TrayScenario, MAX_SCENARIO_ID_CHARS, MAX_TRAY_SCENARIOS};

use menu::{build_menu, sanitize_label, tray_action, TrayAction};
use serde::Serialize;
use std::sync::Arc;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter};

use super::{show_main_window, window_state, LifecycleState};

const TRAY_ID: &str = "kesvio";
const RUN_SCENARIO_EVENT: &str = "tray://run-scenario";
const TOOLTIP: &str = "KesVio";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TrayScenarioRun {
    id: String,
}

pub(crate) fn apply_scenarios(app: &AppHandle, scenarios: Vec<TrayScenario>) {
    let handle = app.clone();
    if let Err(error) = app.run_on_main_thread(move || {
        let Some(tray) = handle.tray_by_id(TRAY_ID) else {
            return;
        };
        let scan_item = match scan::create_item(&handle) {
            Ok(item) => item,
            Err(error) => {
                log::error!("Could not build tray scan item: {error}");
                return;
            }
        };
        match build_menu(&handle, &scenarios, &scan_item) {
            Ok(menu) => {
                if let Err(error) = tray.set_menu(Some(menu)) {
                    log::error!("Could not update the tray menu: {error}");
                } else {
                    scan::remember_item(&handle, scan_item);
                }
            }
            Err(error) => log::error!("Could not build the tray menu: {error}"),
        }
    }) {
        log::error!("Could not reach the main thread for the tray menu: {error}");
    }
}

pub(crate) fn apply_running(app: &AppHandle, label: Option<String>) {
    let handle = app.clone();
    let tooltip = label
        .map(|name| format!("{TOOLTIP} — running {}", sanitize_label(&name)))
        .unwrap_or_else(|| TOOLTIP.to_owned());
    if let Err(error) = app.run_on_main_thread(move || {
        if let Some(tray) = handle.tray_by_id(TRAY_ID) {
            if let Err(error) = tray.set_tooltip(Some(&tooltip)) {
                log::error!("Could not update the tray tooltip: {error}");
            }
        }
    }) {
        log::error!("Could not reach the main thread for the tray tooltip: {error}");
    }
}

pub(crate) fn setup_tray(app: &AppHandle, state: Arc<LifecycleState>) -> tauri::Result<()> {
    let scan_item = scan::create_item(app)?;
    let menu = build_menu(app, &[], &scan_item)?;
    let icon = app.default_window_icon().cloned();
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip(TOOLTIP)
        .on_menu_event(move |app, event| match tray_action(event.id().as_ref()) {
            Some(TrayAction::Open) => show_main_window(app),
            Some(TrayAction::ForceFullScan) => scan::request(app),
            Some(TrayAction::Quit) => {
                window_state::persist(app, &state);
                state.mark_quitting();
                app.exit(0);
            }
            Some(TrayAction::RunScenario(id)) => {
                let _ = app.emit(RUN_SCENARIO_EVENT, TrayScenarioRun { id });
            }
            None => {}
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                show_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = icon {
        builder = builder.icon(icon);
    }
    builder.build(app)?;
    scan::remember_item(app, scan_item);
    Ok(())
}

#[cfg(test)]
pub(crate) fn run_scenario_sample() -> serde_json::Value {
    serde_json::to_value(TrayScenarioRun {
        id: "custom:1".into(),
    })
    .expect("the tray payload serializes")
}
