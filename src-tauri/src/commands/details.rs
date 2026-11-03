use super::{is_valid_catalog_id, run_blocking};
use crate::app_state::{
    app_details_target_for, cached_app_details_for, remember_app_details, AppState,
};
use crate::catalog::cache;
use crate::catalog::{
    details_fingerprint, folder_target, measure_folder, read_cached_details, read_details,
    AppDetails, AppDetailsTarget, FolderSize,
};
use crate::error::AppError;
use crate::paths;
use crate::platform::windows::open_trusted_folder;
use std::path::PathBuf;
use tauri::Manager;

fn resolve_app_details_target(state: &AppState, id: &str) -> Result<AppDetailsTarget, AppError> {
    if !is_valid_catalog_id(id) {
        return Err(AppError::AppDetailsUnavailable);
    }
    app_details_target_for(state, id).ok_or(AppError::AppDetailsUnavailable)
}

fn resolve_folder_target(state: &AppState, id: &str) -> Result<AppDetailsTarget, AppError> {
    resolve_app_details_target(state, id).map_err(|_| AppError::OpenFolderUnavailable)
}

fn validate_details_volume_with(
    target: &AppDetailsTarget,
    valid: impl Fn(&str, Option<&str>) -> bool,
) -> Result<(), AppError> {
    target
        .volume_paths()
        .all(|(path, volume)| valid(path, volume))
        .then_some(())
        .ok_or(AppError::AppDetailsUnavailable)
}

fn validate_details_volume(target: &AppDetailsTarget) -> Result<(), AppError> {
    validate_details_volume_with(target, |path, volume| {
        super::launch::validate_target_volume(path, volume).is_ok()
    })
}

async fn load_persisted_details(
    cache_dir: PathBuf,
    app_id: String,
    fingerprint: String,
) -> Result<Option<AppDetails>, AppError> {
    let cached = run_blocking("App details cache read", move || {
        cache::read_document(&cache_dir)
            .and_then(|document| read_cached_details(&document, &app_id, &fingerprint))
    })
    .await?;
    Ok(cached)
}

#[tauri::command]
pub(crate) async fn get_app_details(
    app: tauri::AppHandle,
    id: String,
) -> Result<AppDetails, AppError> {
    let state = app.state::<AppState>();
    let target = resolve_app_details_target(state.inner(), &id)?;
    let cache_dir = paths::data_dir(&app).ok();
    let fingerprint = run_blocking("App detail fingerprint", {
        let target = target.clone();
        move || {
            validate_details_volume(&target)?;
            Ok::<_, AppError>(details_fingerprint(&target))
        }
    })
    .await??;
    if let Some(fingerprint) = fingerprint {
        if let Some(cached) = cached_app_details_for(state.inner(), &id, &fingerprint) {
            return Ok(cached);
        }
        if let Some(cache_dir) = cache_dir {
            if let Some(cached) =
                load_persisted_details(cache_dir, id.clone(), fingerprint.clone()).await?
            {
                remember_app_details(state.inner(), id, fingerprint, cached.clone());
                return Ok(cached);
            }
        }

        let details_target = target.clone();
        let details = run_blocking("App detail read", move || {
            validate_details_volume(&details_target)?;
            Ok::<_, AppError>(read_details(&details_target))
        })
        .await??;
        remember_app_details(state.inner(), id, fingerprint, details.clone());
        return Ok(details);
    }

    let details_target = target.clone();
    run_blocking("App detail read", move || {
        validate_details_volume(&details_target)?;
        Ok::<_, AppError>(read_details(&details_target))
    })
    .await?
}

#[tauri::command]
pub(crate) async fn open_app_folder(app: tauri::AppHandle, id: String) -> Result<(), AppError> {
    let target = resolve_folder_target(&app.state::<AppState>(), &id)?;
    run_blocking("Application folder open", move || {
        validate_details_volume(&target).map_err(|_| ())?;
        folder_target(&target)
            .ok_or(())
            .and_then(|folder| open_trusted_folder(&folder))
    })
    .await?
    .map_err(|_| AppError::OpenFolderUnavailable)
}

#[tauri::command]
pub(crate) async fn measure_app_folder(
    app: tauri::AppHandle,
    id: String,
) -> Result<FolderSize, AppError> {
    let target = resolve_folder_target(&app.state::<AppState>(), &id)?;
    run_blocking("Application folder size", move || {
        validate_details_volume(&target).map_err(|_| AppError::OpenFolderUnavailable)?;
        folder_target(&target)
            .map(|folder| measure_folder(&folder))
            .ok_or(AppError::OpenFolderUnavailable)
    })
    .await?
}

#[cfg(test)]
mod tests {
    use super::{resolve_app_details_target, resolve_folder_target};
    use crate::app_state::{cached_app, remember_catalog, AppState};
    use crate::catalog::LaunchKind;
    use crate::commands::MAX_CATALOG_ID_LENGTH;
    use crate::error::AppError;

    #[test]
    fn resolves_only_known_bounded_ids() {
        let state = AppState::default();
        let mut executable = cached_app("Editor", r"C:\Editor\editor.exe");
        executable.id = "editor".into();
        let mut aumid = cached_app("Store app", "Contoso.Store_123!App");
        aumid.id = "store".into();
        aumid.launch_kind = LaunchKind::AppUserModelId;
        remember_catalog(&state, &[executable, aumid]);

        assert!(resolve_app_details_target(&state, "editor").is_ok());
        assert!(matches!(
            resolve_app_details_target(&state, &"x".repeat(MAX_CATALOG_ID_LENGTH + 1)),
            Err(AppError::AppDetailsUnavailable)
        ));
        assert!(matches!(
            resolve_app_details_target(&state, "missing"),
            Err(AppError::AppDetailsUnavailable)
        ));
        assert!(matches!(
            resolve_folder_target(&state, "missing"),
            Err(AppError::OpenFolderUnavailable)
        ));
    }
}

#[test]
fn details_target_keeps_volume_identity_for_operation_validation() {
    let mut app = crate::app_state::cached_app("Portable", r"Q:\Portable\app.exe");
    app.volume_id = Some("12345678".into());
    let target = crate::catalog::AppDetailsTarget::from_app(&app);
    assert!(validate_details_volume_with(&target, |path, volume| {
        assert_eq!(path, r"Q:\Portable\app.exe");
        assert_eq!(volume, Some("12345678"));
        false
    })
    .is_err());
}

#[test]
fn details_rejects_a_resolved_path_on_a_different_volume() {
    let mut app = crate::app_state::cached_app("Portable", r"Q:\Portable\app.exe");
    app.volume_id = Some("12345678".into());
    app.resolved_path = Some(r"R:\Other\app.exe".into());
    let target = crate::catalog::AppDetailsTarget::from_app(&app);
    assert!(validate_details_volume_with(&target, |path, _| path.starts_with("Q:")).is_err());
}
