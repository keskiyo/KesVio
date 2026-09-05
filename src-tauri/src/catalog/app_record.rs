use super::{classify, AppInfo, ArtifactKind, LaunchKind, SourceKind};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

pub(super) fn make_app(name: String, path: PathBuf) -> AppInfo {
    let path = path.to_string_lossy().to_string();
    let normalized = path.to_lowercase();
    let id = format!("{:x}", Sha256::digest(normalized.as_bytes()));
    let category = classify::classify(&name, &path);
    let launch_kind = if Path::new(&path)
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("lnk"))
    {
        LaunchKind::Shortcut
    } else {
        LaunchKind::Executable
    };
    AppInfo {
        id,
        name,
        path,
        icon_base64: None,
        artifact_kind: ArtifactKind::Application,
        category,
        launch_kind,
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
