use super::run_blocking;
use crate::error::AppError;
use tauri_plugin_dialog::DialogExt;

const MAX_PREFERENCES_BACKUP_BYTES: usize = 1_048_576;

fn validate_preferences_backup_contents(contents: &str) -> Result<(), AppError> {
    if contents.is_empty()
        || contents.len() > MAX_PREFERENCES_BACKUP_BYTES
        || !serde_json::from_str::<serde_json::Value>(contents).is_ok_and(|value| value.is_object())
    {
        return Err(AppError::SavePreferencesBackup(String::new()));
    }
    Ok(())
}

#[tauri::command]
pub(crate) async fn save_preferences_backup(
    app: tauri::AppHandle,
    contents: String,
) -> Result<bool, AppError> {
    validate_preferences_backup_contents(&contents)?;
    let Some(file) = app
        .dialog()
        .file()
        .set_title("Export settings")
        .set_file_name("kesvio-settings.json")
        .add_filter("JSON files", &["json"])
        .blocking_save_file()
    else {
        return Ok(false);
    };
    let path = file
        .into_path()
        .map_err(|error| AppError::SavePreferencesBackup(error.to_string()))?;
    run_blocking("Preferences backup export", move || {
        std::fs::write(path, contents)
            .map_err(|error| AppError::SavePreferencesBackup(error.to_string()))
    })
    .await??;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preference_backup_contents_must_be_a_bounded_json_object() {
        assert!(validate_preferences_backup_contents(r#"{"version":14}"#).is_ok());
        assert!(validate_preferences_backup_contents("").is_err());
        assert!(validate_preferences_backup_contents("[]").is_err());
        assert!(validate_preferences_backup_contents(
            &"x".repeat(MAX_PREFERENCES_BACKUP_BYTES + 1)
        )
        .is_err());
    }
}
