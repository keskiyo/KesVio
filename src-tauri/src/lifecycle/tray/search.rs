use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager};

pub(crate) const SEARCH_EVENT: &str = "tray://search";

#[derive(Default)]
pub(crate) struct TraySearchIntent {
    pending: AtomicBool,
}

impl TraySearchIntent {
    pub(crate) fn raise(&self) {
        self.pending.store(true, Ordering::SeqCst);
    }

    pub(crate) fn take(&self) -> bool {
        self.pending.swap(false, Ordering::SeqCst)
    }
}

pub(super) fn request(app: &AppHandle) {
    if let Some(intent) = app.try_state::<TraySearchIntent>() {
        intent.raise();
    }
    crate::lifecycle::show_main_window(app);
    if let Err(error) = app.emit(SEARCH_EVENT, ()) {
        log::error!("Could not dispatch the tray search request: {error}");
    }
}

pub(crate) fn take_intent(app: &AppHandle) -> bool {
    app.try_state::<TraySearchIntent>()
        .is_some_and(|intent| intent.take())
}

#[cfg(test)]
mod tests {
    use super::*;

    // The click can land before the interface has a listener, so the intent waits until the
    // interface asks for it — and is handed over exactly once.
    #[test]
    fn a_raised_intent_is_taken_once() {
        let intent = TraySearchIntent::default();

        assert!(!intent.take());
        intent.raise();
        intent.raise();
        assert!(intent.take());
        assert!(!intent.take());
    }
}
