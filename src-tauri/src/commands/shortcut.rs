use super::run_blocking;
use crate::app_state::AppState;
use crate::error::AppError;
use crate::paths;
use crate::platform::windows::global_shortcut;
use tauri::Manager;

#[tauri::command]
pub(crate) async fn set_global_shortcut(
    app: tauri::AppHandle,
    binding: global_shortcut::Binding,
) -> Result<global_shortcut::Status, AppError> {
    binding
        .validate()
        .map_err(|()| AppError::InvalidGlobalShortcut)?;
    let state = app.state::<AppState>();
    let current = state
        .shortcut_status
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .clone();
    let label = binding
        .label()
        .map_err(|()| AppError::InvalidGlobalShortcut)?;
    if current.available && current.label == label {
        return Ok(current);
    }
    let app_data_dir =
        paths::data_dir(&app).map_err(|error| AppError::AppDataDir(error.to_string()))?;
    let registration_app = app.clone();
    let registration_binding = binding.clone();
    let registered = run_blocking("Global shortcut registration", move || {
        global_shortcut::register(registration_app, registration_binding)
    })
    .await?;
    if !registered.status.available {
        return Err(AppError::GlobalShortcutUnavailable);
    }
    let stored_binding = binding.clone();
    run_blocking("Global shortcut settings update", move || {
        global_shortcut::write(&app_data_dir, &stored_binding)
    })
    .await?
    .map_err(|error| AppError::SaveGlobalShortcut(error.to_string()))?;
    let status = registered.status.clone();
    crate::lifecycle::set_tray_shortcut(&app, Some(status.label.clone()));
    *state
        .global_shortcut
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = registered.guard;
    *state
        .shortcut_status
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = registered.status;
    Ok(status)
}
