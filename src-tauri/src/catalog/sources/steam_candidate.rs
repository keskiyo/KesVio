use super::steam::SteamGame;
use crate::catalog::identity::{find_executable, stable_id};
use crate::catalog::{AppCategory, AppInfo, ArtifactKind, LaunchKind, SourceKind};

pub(in crate::catalog) fn steam_app(game: SteamGame) -> AppInfo {
    let path = format!("steam://rungameid/{}", game.app_id);
    let product_name = game.name.clone();
    AppInfo {
        id: stable_id(&path),
        category: AppCategory::Games,
        name: game.name,
        path,
        icon_base64: None,
        artifact_kind: ArtifactKind::Application,
        launch_kind: LaunchKind::Executable,
        source_kind: SourceKind::Steam,
        description: None,
        version: None,
        publisher: None,
        product_name: Some(product_name),
        original_filename: None,
        install_location: Some(game.install_dir.to_string_lossy().into_owned()),
        can_uninstall: false,
        resolved_path: find_executable(&game.install_dir.to_string_lossy())
            .map(|path| path.to_string_lossy().into_owned()),
        shortcut_icon_path: None,
        launch_arguments: None,
        canonical_identity: None,
        preference_identity: None,
        visibility_class: Default::default(),
        visibility_score: 0,
        visibility_reasons: Vec::new(),
        target_availability: None,
        category_reasons: Vec::new(),
        close_risk: None,
    }
}
