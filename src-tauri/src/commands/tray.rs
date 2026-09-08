use crate::error::AppError;
use crate::lifecycle::{TrayScenario, MAX_SCENARIO_ID_CHARS, MAX_TRAY_SCENARIOS};
use tauri::AppHandle;

const MAX_RUNNING_LABEL_CHARS: usize = 120;

fn accepted(entries: Vec<TrayScenario>) -> Vec<TrayScenario> {
    entries
        .into_iter()
        .filter(|entry| {
            let id = entry.id.trim();
            !id.is_empty() && id.chars().count() <= MAX_SCENARIO_ID_CHARS
        })
        .take(MAX_TRAY_SCENARIOS)
        .collect()
}

fn accepted_label(label: Option<String>) -> Option<String> {
    label
        .map(|value| {
            value
                .chars()
                .take(MAX_RUNNING_LABEL_CHARS)
                .collect::<String>()
        })
        .filter(|value| !value.trim().is_empty())
}

#[tauri::command]
pub(crate) async fn set_tray_scenarios(
    app: AppHandle,
    entries: Vec<TrayScenario>,
) -> Result<(), AppError> {
    crate::lifecycle::set_tray_scenarios(&app, accepted(entries));
    Ok(())
}

#[tauri::command]
pub(crate) async fn set_tray_running(
    app: AppHandle,
    label: Option<String>,
) -> Result<(), AppError> {
    crate::lifecycle::set_tray_running(&app, accepted_label(label));
    Ok(())
}

#[tauri::command]
pub(crate) async fn set_tray_scan_state(app: AppHandle, busy: bool) -> Result<(), AppError> {
    crate::lifecycle::set_tray_scan_state(&app, busy);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(id: &str) -> TrayScenario {
        TrayScenario {
            id: id.into(),
            label: id.into(),
            favorite: false,
        }
    }

    #[test]
    fn the_tray_never_receives_more_entries_than_it_shows() {
        let entries = (0..MAX_TRAY_SCENARIOS + 3)
            .map(|index| entry(&format!("custom:{index}")))
            .collect();

        assert_eq!(accepted(entries).len(), MAX_TRAY_SCENARIOS);
    }

    #[test]
    fn an_entry_without_a_usable_id_never_reaches_the_menu() {
        let entries = vec![
            entry(""),
            entry("   "),
            entry(&"a".repeat(MAX_SCENARIO_ID_CHARS + 1)),
            entry("custom:1"),
        ];

        assert_eq!(accepted(entries), vec![entry("custom:1")]);
    }

    #[test]
    fn a_blank_running_label_clears_the_tooltip_instead_of_showing_nothing() {
        assert_eq!(accepted_label(Some("   ".into())), None);
        assert_eq!(accepted_label(None), None);
        assert_eq!(accepted_label(Some("Work".into())), Some("Work".into()));
    }

    #[test]
    fn a_running_label_is_bounded_before_it_reaches_the_shell() {
        let label = accepted_label(Some("a".repeat(MAX_RUNNING_LABEL_CHARS * 2)));

        assert_eq!(
            label.map(|value| value.chars().count()),
            Some(MAX_RUNNING_LABEL_CHARS)
        );
    }
}
