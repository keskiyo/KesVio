use super::LifecycleState;
use crate::platform::windows::backdrop;
use serde::Serialize;
use tauri::window::{Effect, EffectsBuilder};
use tauri::{AppHandle, Manager};

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum WindowBackdrop {
    Mica,
    Solid,
}

pub(crate) fn backdrop_for(mica_applied: bool) -> WindowBackdrop {
    if mica_applied {
        WindowBackdrop::Mica
    } else {
        WindowBackdrop::Solid
    }
}

pub(crate) fn apply_backdrop(app: &AppHandle, lifecycle: &LifecycleState) {
    if !backdrop::supports_mica() {
        log::info!("Window backdrop: solid (Mica needs Windows 11)");
        return;
    }
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    match window.set_effects(EffectsBuilder::new().effect(Effect::MicaDark).build()) {
        Ok(()) => {
            lifecycle.mark_mica_applied();
            log::info!("Window backdrop: Mica");
        }
        Err(error) => log::warn!("Window backdrop: Mica refused ({error}); staying solid"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_backdrop_is_mica_only_once_it_was_applied() {
        assert_eq!(backdrop_for(true), WindowBackdrop::Mica);
        assert_eq!(backdrop_for(false), WindowBackdrop::Solid);
    }

    #[test]
    fn the_backdrop_serializes_as_a_lowercase_word() {
        assert_eq!(
            serde_json::to_value(WindowBackdrop::Mica).unwrap(),
            serde_json::json!("mica")
        );
        assert_eq!(
            serde_json::to_value(WindowBackdrop::Solid).unwrap(),
            serde_json::json!("solid")
        );
    }
}
