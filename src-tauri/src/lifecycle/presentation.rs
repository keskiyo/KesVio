use super::{show_main_window, window_state, LifecycleState};
use std::time::Instant;
use tauri::{App, Listener};

const FRONTEND_READY_EVENT: &str = "app://frontend-ready";

#[derive(Debug, PartialEq, Eq)]
enum PresentationMode {
    StayHidden,
    WaitForFrontend,
}

fn presentation_mode(stay_hidden: bool) -> PresentationMode {
    if stay_hidden {
        PresentationMode::StayHidden
    } else {
        PresentationMode::WaitForFrontend
    }
}

pub(crate) fn prepare_main_window(app: &App, lifecycle: &LifecycleState, stay_hidden: bool) {
    window_state::restore_main_window(app.handle(), lifecycle);
    if presentation_mode(stay_hidden) == PresentationMode::StayHidden {
        return;
    }
    let handle = app.handle().clone();
    let waiting_since = Instant::now();
    app.once(FRONTEND_READY_EVENT, move |_| {
        log::info!(
            "Frontend ready: {}ms after the window was prepared",
            waiting_since.elapsed().as_millis()
        );
        show_main_window(&handle);
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normal_startup_waits_for_frontend() {
        assert_eq!(presentation_mode(false), PresentationMode::WaitForFrontend);
    }

    #[test]
    fn tray_autostart_stays_hidden() {
        assert_eq!(presentation_mode(true), PresentationMode::StayHidden);
    }
}
