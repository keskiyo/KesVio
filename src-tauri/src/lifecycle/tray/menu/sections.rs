use super::super::model::{TrayFavorite, TrayModel, TrayScenario};
use super::labels::{favorite_labels, menu_label};
use super::{
    FAVORITES_LABEL, FAVORITE_PREFIX, RECENT_HEADER_ID, RECENT_LABEL, RECENT_PREFIX,
    SCENARIOS_LABEL, SCENARIO_PREFIX, SHOW_ALL_FAVORITES_LABEL, SHOW_FAVORITES_ID,
};
use tauri::menu::{IsMenuItem, MenuItem, Submenu};
use tauri::AppHandle;

pub(super) fn favorites_submenu(
    app: &AppHandle,
    model: &TrayModel,
) -> tauri::Result<Submenu<tauri::Wry>> {
    let labels = favorite_labels(&model.favorites);
    let mut entries = model
        .favorites
        .iter()
        .zip(labels)
        .map(|(favorite, label)| {
            MenuItem::with_id(
                app,
                format!("{FAVORITE_PREFIX}{}", favorite.id),
                label,
                true,
                None::<&str>,
            )
        })
        .collect::<tauri::Result<Vec<_>>>()?;
    if model.more_favorites {
        entries.push(MenuItem::with_id(
            app,
            SHOW_FAVORITES_ID,
            SHOW_ALL_FAVORITES_LABEL,
            true,
            None::<&str>,
        )?);
    }
    let references = entries
        .iter()
        .map(|entry| entry as &dyn IsMenuItem<tauri::Wry>)
        .collect::<Vec<_>>();
    Submenu::with_items(app, FAVORITES_LABEL, true, &references)
}

pub(super) fn recent_rows(
    app: &AppHandle,
    recent: &[TrayFavorite],
) -> tauri::Result<Vec<Box<dyn IsMenuItem<tauri::Wry>>>> {
    let mut rows: Vec<Box<dyn IsMenuItem<tauri::Wry>>> = vec![Box::new(MenuItem::with_id(
        app,
        RECENT_HEADER_ID,
        RECENT_LABEL,
        false,
        None::<&str>,
    )?)];
    for (entry, label) in recent.iter().zip(favorite_labels(recent)) {
        rows.push(Box::new(MenuItem::with_id(
            app,
            format!("{RECENT_PREFIX}{}", entry.id),
            label,
            true,
            None::<&str>,
        )?));
    }
    Ok(rows)
}

pub(super) fn scenarios_submenu(
    app: &AppHandle,
    scenarios: &[TrayScenario],
) -> tauri::Result<Submenu<tauri::Wry>> {
    let marked = scenarios.iter().any(|scenario| scenario.favorite);
    let entries = scenarios
        .iter()
        .map(|scenario| {
            MenuItem::with_id(
                app,
                format!("{SCENARIO_PREFIX}{}", scenario.id),
                menu_label(scenario, marked),
                true,
                None::<&str>,
            )
        })
        .collect::<tauri::Result<Vec<_>>>()?;
    let references = entries
        .iter()
        .map(|entry| entry as &dyn IsMenuItem<tauri::Wry>)
        .collect::<Vec<_>>();
    Submenu::with_items(app, SCENARIOS_LABEL, true, &references)
}
