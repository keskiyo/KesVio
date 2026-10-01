use super::run_blocking;
use crate::app_state::{known_catalog_ids, AppState};
use crate::catalog::sync::enqueue_hydration;
use crate::catalog::{self, cache};
use crate::error::AppError;
use crate::paths;
use tauri::Manager;

const MAX_HYDRATION_IDS: usize = 128;
const MAX_HYDRATION_ID_LENGTH: usize = 512;

#[tauri::command]
pub(crate) async fn clear_icon_cache(app: tauri::AppHandle) -> Result<(), AppError> {
    let app_data_dir =
        paths::data_dir(&app).map_err(|error| AppError::AppDataDir(error.to_string()))?;
    run_blocking("Icon cache clear", move || {
        catalog::icon_cache::clear(&app_data_dir)
    })
    .await?
    .map_err(|error| AppError::ClearIconCache(error.to_string()))
}

#[tauri::command]
pub(crate) async fn hydrate_visible_icons(
    app: tauri::AppHandle,
    ids: Vec<String>,
) -> Result<(), AppError> {
    let requested = ids.len();
    let ids = {
        let state = app.state::<AppState>();
        validate_hydration_ids(state.inner(), ids)?
    };
    log::info!("Hydration requested: ids={requested} known={}", ids.len());
    if ids.is_empty() {
        return Ok(());
    }
    let app_data_dir =
        paths::data_dir(&app).map_err(|error| AppError::AppDataDir(error.to_string()))?;
    let cache_dir = app_data_dir.clone();
    let Some(document) = run_blocking("Catalog cache read", move || {
        cache::read_hydration_document(&cache_dir)
    })
    .await?
    else {
        return Ok(());
    };
    enqueue_hydration(app, app_data_dir, document.generation, ids, true);
    Ok(())
}

fn validate_hydration_ids(state: &AppState, ids: Vec<String>) -> Result<Vec<String>, AppError> {
    if ids.len() > MAX_HYDRATION_IDS
        || ids
            .iter()
            .any(|id| id.chars().count() > MAX_HYDRATION_ID_LENGTH)
    {
        return Err(AppError::InvalidHydrationRequest);
    }
    Ok(known_catalog_ids(state, ids))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app_state::{cached_app, remember_catalog};

    #[test]
    fn hydration_ids_are_deduplicated_and_limited_to_the_trusted_catalog() {
        let state = AppState::default();
        let mut known = cached_app("Known", r"C:\Known.exe");
        known.id = "known".into();
        remember_catalog(&state, &[known]);

        assert_eq!(
            validate_hydration_ids(
                &state,
                vec![
                    "known".into(),
                    String::new(),
                    "unknown".into(),
                    "known".into(),
                ]
            )
            .unwrap(),
            vec!["known"]
        );
    }

    #[test]
    fn hydration_rejects_oversized_id_lists() {
        let state = AppState::default();
        let ids = (0..=MAX_HYDRATION_IDS)
            .map(|index| format!("app-{index}"))
            .collect();

        assert!(matches!(
            validate_hydration_ids(&state, ids),
            Err(AppError::InvalidHydrationRequest)
        ));
    }

    #[test]
    fn hydration_rejects_oversized_ids() {
        let state = AppState::default();

        assert!(matches!(
            validate_hydration_ids(&state, vec!["x".repeat(MAX_HYDRATION_ID_LENGTH + 1)]),
            Err(AppError::InvalidHydrationRequest)
        ));
    }

    #[test]
    fn hydration_length_limit_counts_unicode_characters() {
        let state = AppState::default();
        let accepted_id = "я".repeat(MAX_HYDRATION_ID_LENGTH);
        let mut known = cached_app("Known", r"C:\Known.exe");
        known.id = accepted_id.clone();
        remember_catalog(&state, &[known]);

        assert_eq!(
            validate_hydration_ids(&state, vec![accepted_id.clone()]).unwrap(),
            vec![accepted_id]
        );
        assert!(matches!(
            validate_hydration_ids(&state, vec!["я".repeat(MAX_HYDRATION_ID_LENGTH + 1)]),
            Err(AppError::InvalidHydrationRequest)
        ));
    }
}
