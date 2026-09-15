use serde::Deserialize;
use std::sync::Mutex;

pub(crate) const MAX_TRAY_SCENARIOS: usize = 5;
pub(crate) const MAX_TRAY_FAVORITES: usize = 5;
pub(crate) const MAX_SCENARIO_ID_CHARS: usize = 512;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TrayScenario {
    pub(crate) id: String,
    pub(crate) label: String,
    #[serde(default)]
    pub(crate) favorite: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TrayFavorite {
    pub(crate) id: String,
    pub(crate) label: String,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub(crate) struct TrayModel {
    pub(crate) scenarios: Vec<TrayScenario>,
    pub(crate) favorites: Vec<TrayFavorite>,
    pub(crate) more_favorites: bool,
}

#[derive(Default)]
pub(crate) struct TrayModelState(pub(crate) Mutex<TrayModel>);

impl TrayModelState {
    pub(crate) fn update(&self, change: impl FnOnce(&mut TrayModel)) -> Option<TrayModel> {
        let mut model = self.0.lock().ok()?;
        let before = model.clone();
        change(&mut model);
        (*model != before).then(|| model.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_model_reports_only_real_changes() {
        let state = TrayModelState::default();

        assert!(state.update(|model| model.more_favorites = false).is_none());
        let changed = state.update(|model| model.more_favorites = true);
        assert_eq!(changed.map(|model| model.more_favorites), Some(true));
        assert!(state.update(|model| model.more_favorites = true).is_none());
    }
}
