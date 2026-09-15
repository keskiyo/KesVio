mod presentation;
mod quiet_start;
mod startup;
mod state;
mod tray;
pub(crate) mod window_state;

pub(crate) use presentation::prepare_main_window;
pub(crate) use quiet_start::STARTUP_SCAN_DELAY;
pub(crate) use startup::spawn as start_background_initialization;
pub(crate) use state::LifecycleState;
#[cfg(test)]
pub(crate) use tray::launch_app_sample as tray_launch_app_sample;
#[cfg(test)]
pub(crate) use tray::run_scenario_sample as tray_run_scenario_sample;
pub(crate) use tray::{
    apply_favorites as set_tray_favorites, apply_running as set_tray_running,
    apply_scan_state as set_tray_scan_state, apply_scenarios as set_tray_scenarios, setup_tray,
    take_search_intent as take_tray_search_intent, TrayFavorite, TrayScenario,
    MAX_SCENARIO_ID_CHARS, MAX_TRAY_FAVORITES, MAX_TRAY_SCENARIOS,
};
#[cfg(test)]
pub(crate) use tray::{FORCE_SCAN_EVENT, LAUNCH_APP_EVENT, SEARCH_EVENT, SHOW_FAVORITES_EVENT};

use crate::platform::windows::process_priority::{set_own_priority, OwnPriority};
use std::ffi::OsStr;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

pub(crate) fn show_main_window(app: &AppHandle) {
    if let Some(lifecycle) = app.try_state::<Arc<LifecycleState>>() {
        if lifecycle.end_quiet_start() {
            log::info!("Quiet start ended: window requested");
            set_own_priority(OwnPriority::Normal);
        }
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub(crate) fn starts_hidden_from_autostart<I, S>(args: I) -> bool
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    args.into_iter()
        .any(|argument| argument.as_ref() == OsStr::new("--autostart"))
}

pub(crate) fn should_hide_on_autostart(autostart: bool, tray_ready: bool) -> bool {
    autostart && tray_ready
}

pub(crate) fn should_show_on_second_instance<I, S>(args: I) -> bool
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    !starts_hidden_from_autostart(args)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn autostart_mode_requires_an_exact_argument() {
        assert!(starts_hidden_from_autostart(["app.exe", "--autostart"]));
        assert!(!starts_hidden_from_autostart(["app.exe"]));
        assert!(!starts_hidden_from_autostart([
            "app.exe",
            "--autostart-extra",
        ]));
    }

    #[test]
    fn autostart_hides_only_when_the_tray_is_ready() {
        assert!(should_hide_on_autostart(true, true));
        assert!(!should_hide_on_autostart(true, false));
        assert!(!should_hide_on_autostart(false, true));
    }

    #[test]
    fn second_autostart_invocation_keeps_the_existing_window_hidden() {
        assert!(!should_show_on_second_instance(["app.exe", "--autostart"]));
        assert!(should_show_on_second_instance(["app.exe"]));
    }
}
