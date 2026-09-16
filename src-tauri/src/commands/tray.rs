use crate::error::AppError;
use crate::lifecycle::{
    TrayFavorite, TrayScenario, MAX_SCENARIO_ID_CHARS, MAX_TRAY_FAVORITES, MAX_TRAY_SCENARIOS,
};
use tauri::AppHandle;

const MAX_RUNNING_LABEL_CHARS: usize = 120;

fn usable_id(id: &str) -> bool {
    let id = id.trim();
    !id.is_empty() && id.chars().count() <= MAX_SCENARIO_ID_CHARS
}

fn accepted(entries: Vec<TrayScenario>) -> Vec<TrayScenario> {
    entries
        .into_iter()
        .filter(|entry| usable_id(&entry.id))
        .take(MAX_TRAY_SCENARIOS)
        .collect()
}

fn accepted_favorites(entries: Vec<TrayFavorite>) -> Vec<TrayFavorite> {
    entries
        .into_iter()
        .filter(|entry| usable_id(&entry.id) && crate::commands::is_valid_catalog_id(&entry.id))
        .take(MAX_TRAY_FAVORITES)
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
pub(crate) async fn set_tray_favorites(
    app: AppHandle,
    entries: Vec<TrayFavorite>,
    more: bool,
) -> Result<(), AppError> {
    crate::lifecycle::set_tray_favorites(&app, accepted_favorites(entries), more);
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

#[tauri::command]
pub(crate) fn take_tray_search_intent(app: AppHandle) -> bool {
    crate::lifecycle::take_tray_search_intent(&app)
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

    fn favorite(id: &str) -> TrayFavorite {
        TrayFavorite {
            id: id.into(),
            label: id.into(),
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
    fn favorites_are_capped_and_drop_blank_or_oversized_ids() {
        let entries = [
            favorite(""),
            favorite(&"a".repeat(MAX_SCENARIO_ID_CHARS + 1)),
        ]
        .into_iter()
        .chain(
            (0..MAX_TRAY_FAVORITES + 2)
                .map(|index| favorite(&format!("path:c:\\tools\\app{index}.exe"))),
        )
        .collect::<Vec<_>>();

        let kept = accepted_favorites(entries);

        assert_eq!(kept.len(), MAX_TRAY_FAVORITES);
        assert!(kept.iter().all(|entry| entry.id.starts_with("path:")));
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
