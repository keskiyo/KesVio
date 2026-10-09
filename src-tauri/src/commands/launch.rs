use super::is_valid_catalog_id;
use crate::app_state::{AppState, LaunchTarget};
use crate::error::AppError;
use crate::platform::windows::launcher::{self, ElevatedLaunchError};
use serde::Serialize;
use tauri::{Emitter, Manager};

#[derive(Clone, Serialize)]
pub(crate) struct LaunchStatusPayload {
    id: String,
    state: &'static str,
}

#[cfg(test)]
pub(super) fn status_sample() -> LaunchStatusPayload {
    LaunchStatusPayload {
        id: "editor".into(),
        state: "ready",
    }
}

fn wait_for_launch_ready(handle: &launcher::OwnedProcessHandle) -> &'static str {
    launcher::wait_for_input_idle(handle, 12000);
    "ready"
}

fn resolve_launch_target(state: &AppState, id: &str) -> Result<LaunchTarget, AppError> {
    if !is_valid_catalog_id(id) {
        return Err(AppError::LaunchUnavailable);
    }
    let stored = state
        .launch_targets
        .lock()
        .map_err(|_| AppError::LaunchDataUnavailable)?;
    stored.get(id).cloned().ok_or(AppError::LaunchUnavailable)
}

#[tauri::command]
pub(crate) async fn launch_app(app: tauri::AppHandle, id: String) -> Result<(), AppError> {
    let (launch_target, launch_waits) = {
        let state = app.state::<AppState>();
        (
            resolve_launch_target(&state, &id)?,
            state.launch_waits.clone(),
        )
    };
    let handle = tauri::async_runtime::spawn_blocking(move || {
        launcher::launch(
            launch_target.kind,
            &launch_target.path,
            launch_target.arguments.as_deref(),
        )
    })
    .await
    .map_err(|error| AppError::Interrupted {
        context: "Application launch",
        source: error.to_string(),
    })??;
    if let Some(handle) = handle {
        let emitter = app.clone();
        let launch_id = id.clone();
        let Some(permit) = launch_waits.acquire() else {
            return Ok(());
        };
        tauri::async_runtime::spawn_blocking(move || {
            let _permit = permit;
            let state = wait_for_launch_ready(&handle);
            let _ = emitter.emit(
                "launch://status",
                LaunchStatusPayload {
                    id: launch_id,
                    state,
                },
            );
        });
    }
    Ok(())
}

fn elevated_launch_error(error: ElevatedLaunchError) -> AppError {
    match error {
        ElevatedLaunchError::Unsupported => AppError::LaunchUnavailable,
        ElevatedLaunchError::Cancelled => AppError::LaunchCancelled,
        ElevatedLaunchError::Failed(message) => AppError::Other(message),
    }
}

#[tauri::command]
pub(crate) async fn can_launch_elevated(
    app: tauri::AppHandle,
    id: String,
) -> Result<bool, AppError> {
    let launch_target = resolve_launch_target(&app.state::<AppState>(), &id)?;
    tauri::async_runtime::spawn_blocking(move || {
        launcher::supports_elevated_launch(launch_target.kind, &launch_target.path)
    })
    .await
    .map_err(|error| AppError::Interrupted {
        context: "Elevation check",
        source: error.to_string(),
    })
}

#[tauri::command]
pub(crate) async fn launch_app_elevated(app: tauri::AppHandle, id: String) -> Result<(), AppError> {
    let launch_target = resolve_launch_target(&app.state::<AppState>(), &id)?;
    tauri::async_runtime::spawn_blocking(move || {
        launcher::launch_elevated(
            launch_target.kind,
            &launch_target.path,
            launch_target.arguments.as_deref(),
        )
    })
    .await
    .map_err(|error| AppError::Interrupted {
        context: "Elevated application launch",
        source: error.to_string(),
    })?
    .map_err(elevated_launch_error)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app_state::{cached_app, remember_catalog};
    use crate::commands::MAX_CATALOG_ID_LENGTH;

    #[test]
    fn resolves_a_known_catalog_id_to_its_stored_target() {
        let state = AppState::default();
        let mut app = cached_app("Editor", r"C:\Editor.exe");
        app.id = "editor".into();
        remember_catalog(&state, &[app]);

        let target = resolve_launch_target(&state, "editor").unwrap();

        assert_eq!(target.path, r"C:\Editor.exe");
    }

    #[test]
    fn rejects_an_oversized_id_before_the_lookup() {
        let state = AppState::default();
        let mut app = cached_app("Editor", r"C:\Editor.exe");
        app.id = "x".repeat(MAX_CATALOG_ID_LENGTH + 1);
        remember_catalog(&state, &[app.clone()]);

        assert!(matches!(
            resolve_launch_target(&state, &app.id),
            Err(AppError::LaunchUnavailable)
        ));
    }

    #[test]
    fn accepts_an_id_at_the_length_limit() {
        let state = AppState::default();
        let mut app = cached_app("Editor", r"C:\Editor.exe");
        app.id = "я".repeat(MAX_CATALOG_ID_LENGTH);
        remember_catalog(&state, &[app.clone()]);

        assert!(resolve_launch_target(&state, &app.id).is_ok());
    }

    #[test]
    fn rejects_a_blank_id() {
        let state = AppState::default();

        assert!(matches!(
            resolve_launch_target(&state, "   "),
            Err(AppError::LaunchUnavailable)
        ));
    }

    #[test]
    fn elevated_launch_outcomes_map_to_stable_codes() {
        assert_eq!(
            elevated_launch_error(ElevatedLaunchError::Unsupported),
            AppError::LaunchUnavailable
        );
        assert_eq!(
            elevated_launch_error(ElevatedLaunchError::Cancelled),
            AppError::LaunchCancelled
        );
        assert_eq!(
            elevated_launch_error(ElevatedLaunchError::Failed("x".into())).code(),
            "OPERATION_FAILED"
        );
    }

    #[test]
    fn rejects_an_unknown_id() {
        let state = AppState::default();

        assert!(matches!(
            resolve_launch_target(&state, "missing"),
            Err(AppError::LaunchUnavailable)
        ));
    }
}
