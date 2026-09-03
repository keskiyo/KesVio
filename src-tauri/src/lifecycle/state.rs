use super::window_state::WindowGeometry;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

pub(crate) struct LifecycleState {
    quitting: AtomicBool,
    hides_to_tray: AtomicBool,
    geometry: Mutex<Option<WindowGeometry>>,
}

impl Default for LifecycleState {
    fn default() -> Self {
        Self {
            quitting: AtomicBool::new(false),
            hides_to_tray: AtomicBool::new(true),
            geometry: Mutex::new(None),
        }
    }
}

impl LifecycleState {
    pub(crate) fn mark_quitting(&self) {
        self.quitting.store(true, Ordering::SeqCst);
    }

    pub(crate) fn hides_to_tray(&self) -> bool {
        self.hides_to_tray.load(Ordering::SeqCst)
    }

    pub(crate) fn set_hides_to_tray(&self, hides_to_tray: bool) {
        self.hides_to_tray.store(hides_to_tray, Ordering::SeqCst);
    }

    pub(crate) fn should_hide_on_close(&self) -> bool {
        !self.quitting.load(Ordering::SeqCst) && self.hides_to_tray()
    }

    pub(crate) fn geometry(&self) -> Option<WindowGeometry> {
        self.geometry.lock().ok().and_then(|current| *current)
    }

    pub(crate) fn remember_geometry(&self, geometry: WindowGeometry) {
        if let Ok(mut current) = self.geometry.lock() {
            *current = Some(geometry);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn geometry() -> WindowGeometry {
        WindowGeometry {
            x: 200,
            y: 150,
            width: 1250,
            height: 720,
            maximized: false,
        }
    }

    #[test]
    fn normal_close_hides_the_window() {
        let state = LifecycleState::default();
        assert!(state.should_hide_on_close());
    }

    #[test]
    fn explicit_quit_disables_close_interception() {
        let state = LifecycleState::default();
        state.mark_quitting();
        assert!(!state.should_hide_on_close());
    }

    #[test]
    fn turning_the_tray_setting_off_makes_close_end_the_program() {
        let state = LifecycleState::default();
        assert!(state.hides_to_tray());
        assert!(state.should_hide_on_close());

        state.set_hides_to_tray(false);

        assert!(!state.should_hide_on_close());
    }

    #[test]
    fn quitting_overrides_the_tray_setting_in_both_directions() {
        let state = LifecycleState::default();
        state.set_hides_to_tray(true);
        state.mark_quitting();

        assert!(!state.should_hide_on_close());
    }

    #[test]
    fn a_fresh_session_has_no_geometry_to_restore() {
        assert_eq!(LifecycleState::default().geometry(), None);
    }

    #[test]
    fn the_latest_remembered_geometry_wins() {
        let state = LifecycleState::default();
        state.remember_geometry(geometry());
        state.remember_geometry(WindowGeometry {
            maximized: true,
            ..geometry()
        });

        assert_eq!(
            state.geometry(),
            Some(WindowGeometry {
                maximized: true,
                ..geometry()
            })
        );
    }
}
