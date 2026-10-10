use super::{sanitize_label, TOOLTIP, TRAY_ID};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[derive(Default)]
pub(super) struct TrayTooltip(Mutex<TooltipParts>);

#[derive(Default)]
pub(super) struct TooltipParts {
    pub(super) running: Option<String>,
    pub(super) shortcut: Option<String>,
}

fn text(parts: &TooltipParts) -> String {
    match (&parts.running, &parts.shortcut) {
        (Some(name), _) => format!("{TOOLTIP} — running {}", sanitize_label(name)),
        (None, Some(keys)) => format!("{TOOLTIP} — {}", sanitize_label(keys)),
        (None, None) => TOOLTIP.to_owned(),
    }
}

pub(super) fn apply(app: &AppHandle, change: impl FnOnce(&mut TooltipParts)) {
    let Some(state) = app.try_state::<TrayTooltip>() else {
        return;
    };
    let tooltip = {
        let mut parts = state
            .0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        change(&mut parts);
        text(&parts)
    };
    let handle = app.clone();
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

#[cfg(test)]
mod tests {
    use super::*;

    fn parts(running: Option<&str>, shortcut: Option<&str>) -> TooltipParts {
        TooltipParts {
            running: running.map(str::to_owned),
            shortcut: shortcut.map(str::to_owned),
        }
    }

    #[test]
    fn names_the_shortcut_that_opens_kesvio_while_idle() {
        assert_eq!(
            text(&parts(None, Some("Win+Shift+Q"))),
            "KesVio — Win+Shift+Q"
        );
    }

    #[test]
    fn stays_plain_when_no_shortcut_is_registered() {
        assert_eq!(text(&parts(None, None)), "KesVio");
    }

    #[test]
    fn a_running_scenario_takes_precedence_over_the_shortcut() {
        assert_eq!(
            text(&parts(Some("Gaming"), Some("Win+Shift+Q"))),
            "KesVio — running Gaming"
        );
    }
}
