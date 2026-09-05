use crate::catalog::{AppInfo, LaunchKind};
use std::path::Path;

pub(in crate::catalog) fn icon_source_candidates(app: &AppInfo) -> Vec<String> {
    let mut candidates: Vec<String> = Vec::new();
    let mut push = |value: Option<&String>| {
        if let Some(path) = value {
            if Path::new(path).is_file() && !candidates.contains(path) {
                candidates.push(path.clone());
            }
        }
    };
    push(app.shortcut_icon_path.as_ref());
    push(app.resolved_path.as_ref());
    if app.launch_kind != LaunchKind::AppUserModelId && !candidates.contains(&app.path) {
        candidates.push(app.path.clone());
    }
    candidates
}

#[cfg(test)]
fn icon_source(app: &AppInfo) -> Option<String> {
    icon_source_candidates(app).into_iter().next()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog::{AppCategory, ArtifactKind, SourceKind};

    fn app(name: &str, path: &str) -> AppInfo {
        AppInfo {
            id: String::new(),
            name: name.to_string(),
            path: path.to_string(),
            icon_base64: None,
            artifact_kind: ArtifactKind::Application,
            category: AppCategory::Other,
            launch_kind: LaunchKind::Executable,
            source_kind: SourceKind::Registry,
            description: None,
            version: None,
            publisher: None,
            product_name: None,
            original_filename: None,
            install_location: None,
            can_uninstall: false,
            resolved_path: None,
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

    #[test]
    fn shortcut_icon_source_prefers_target_when_icon_location_is_empty() {
        let dir = tempfile::tempdir().unwrap();
        let shortcut = dir.path().join("Happ.lnk");
        let target = dir.path().join("Happ.exe");
        std::fs::write(&shortcut, []).unwrap();
        std::fs::write(&target, []).unwrap();

        let mut value = app("Happ", &shortcut.to_string_lossy());
        value.launch_kind = LaunchKind::Shortcut;
        value.resolved_path = Some(target.to_string_lossy().into_owned());
        assert_eq!(
            icon_source(&value).as_deref(),
            Some(target.to_string_lossy().as_ref())
        );
    }

    #[test]
    fn icon_candidates_order_icon_location_then_target_then_path() {
        let dir = tempfile::tempdir().unwrap();
        let shortcut = dir.path().join("PgAdmin.lnk");
        let icon = dir.path().join("pgAdmin4.ico");
        let target = dir.path().join("pgAdmin4.exe");
        for file in [&shortcut, &icon, &target] {
            std::fs::write(file, []).unwrap();
        }

        let mut value = app("pgAdmin 4", &shortcut.to_string_lossy());
        value.launch_kind = LaunchKind::Shortcut;
        value.shortcut_icon_path = Some(icon.to_string_lossy().into_owned());
        value.resolved_path = Some(target.to_string_lossy().into_owned());

        let candidates = icon_source_candidates(&value);
        assert_eq!(
            candidates,
            vec![
                icon.to_string_lossy().into_owned(),
                target.to_string_lossy().into_owned(),
                shortcut.to_string_lossy().into_owned(),
            ],
        );
    }

    #[test]
    fn icon_candidates_skip_missing_files_and_aumid_path() {
        let mut value = app("Calc", "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App");
        value.launch_kind = LaunchKind::AppUserModelId;
        value.shortcut_icon_path = Some(r"C:\missing\icon.ico".into());
        assert!(icon_source_candidates(&value).is_empty());
    }
}
