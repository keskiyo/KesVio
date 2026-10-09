use crate::error::AppError;
use crate::lifecycle::{backdrop_for, LifecycleState, WindowBackdrop};
use std::sync::Arc;

#[tauri::command]
pub(crate) fn get_window_backdrop(
    lifecycle: tauri::State<'_, Arc<LifecycleState>>,
) -> Result<WindowBackdrop, AppError> {
    Ok(backdrop_for(lifecycle.mica_applied()))
}
