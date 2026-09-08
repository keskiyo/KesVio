use crate::diagnostics;
use crate::error::AppError;
use crate::paths;
use tauri_plugin_dialog::DialogExt;

use super::run_blocking;

const MAX_KIND_LENGTH: usize = 120;
const MAX_DETAIL_LENGTH: usize = 2000;

fn sanitize(value: &str, limit: usize) -> String {
    value
        .chars()
        .filter(|character| !character.is_control() || *character == '\n')
        .take(limit)
        .collect::<String>()
        .trim()
        .to_string()
}

#[tauri::command]
pub(crate) fn log_client_error(kind: String, detail: String) {
    let kind = sanitize(&kind, MAX_KIND_LENGTH);
    let detail = sanitize(&detail, MAX_DETAIL_LENGTH);
    if kind.is_empty() && detail.is_empty() {
        return;
    }
    log::error!("Interface recovery: {kind} {detail}");
}

#[tauri::command]
pub(crate) async fn export_diagnostics_log(app: tauri::AppHandle) -> Result<bool, AppError> {
    let directory =
        paths::log_dir(&app).map_err(|error| AppError::AppDataDir(error.to_string()))?;
    let Some(file) = app
        .dialog()
        .file()
        .set_title("Export diagnostics log")
        .set_file_name("kesvio-logs.xml")
        .add_filter("XML files", &["xml"])
        .blocking_save_file()
    else {
        return Ok(false);
    };
    let path = file
        .into_path()
        .map_err(|error| AppError::ExportDiagnostics(error.to_string()))?;
    run_blocking("Diagnostics log export", move || {
        log::info!("Diagnostics export starting");
        log::logger().flush();
        let now = std::time::SystemTime::now();
        diagnostics::prune_expired_logs(&directory, now, diagnostics::MAX_LOG_AGE);
        let generated = diagnostics::unix_seconds(now);
        std::fs::write(
            path,
            diagnostics::log_directory_as_xml(&directory, generated),
        )
        .map_err(|error| AppError::ExportDiagnostics(error.to_string()))
    })
    .await??;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::{sanitize, MAX_DETAIL_LENGTH, MAX_KIND_LENGTH};

    #[test]
    fn a_report_is_bounded_and_free_of_control_characters() {
        let noisy = format!("Type\u{0}Error\r\n{}", "x".repeat(MAX_DETAIL_LENGTH * 2));

        let cleaned = sanitize(&noisy, MAX_DETAIL_LENGTH);

        assert_eq!(cleaned.chars().count(), MAX_DETAIL_LENGTH);
        assert!(!cleaned.contains('\u{0}'));
        assert!(!cleaned.contains('\r'));
        assert!(cleaned.starts_with("TypeError\n"));
    }

    #[test]
    fn a_kind_keeps_its_own_shorter_bound() {
        assert_eq!(
            sanitize(&"k".repeat(MAX_KIND_LENGTH + 50), MAX_KIND_LENGTH).len(),
            MAX_KIND_LENGTH
        );
    }

    #[test]
    fn whitespace_only_input_collapses_to_nothing() {
        assert!(sanitize("  \n  ", MAX_DETAIL_LENGTH).is_empty());
    }
}
