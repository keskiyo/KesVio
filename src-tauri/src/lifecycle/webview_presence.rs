use crate::platform::windows::webview_memory::{self, WebviewPresence};
use tauri::{AppHandle, Manager};

pub(crate) fn enter_background(app: &AppHandle) {
    apply(app, WebviewPresence::Background);
}

pub(crate) fn enter_foreground(app: &AppHandle) {
    apply(app, WebviewPresence::Foreground);
}

fn apply(app: &AppHandle, presence: WebviewPresence) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let scheduled = window.with_webview(move |webview| {
        if let Err(error) = webview_memory::apply(&webview, presence) {
            log::warn!(
                "Webview presence {presence:?} not applied (HRESULT {:#x})",
                error.code().0
            );
        }
    });
    if scheduled.is_err() {
        log::warn!("Webview presence {presence:?} could not be scheduled");
    }
}
