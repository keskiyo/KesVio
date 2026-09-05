use crate::catalog::{artifact, filters, machine, make_app, naming};
use crate::catalog::{AppCategory, AppInfo, ArtifactKind, SourceKind};
use std::path::{Path, PathBuf};

pub(in crate::catalog) fn portable_app(
    path: PathBuf,
    facts: &machine::MachineFacts,
) -> Option<AppInfo> {
    let metadata = crate::platform::windows::executable_metadata::read(&path);
    let has_metadata = metadata.product_name.is_some()
        || metadata.description.is_some()
        || metadata.publisher.is_some()
        || metadata.original_filename.is_some();
    let installer_candidate = artifact::has_installer_filename_evidence(
        &path.to_string_lossy(),
        metadata.original_filename.as_deref(),
        metadata.internal_name.as_deref(),
    );
    let stem = path.file_stem()?.to_string_lossy().trim().to_string();
    let parent_matches = path
        .parent()
        .and_then(Path::file_name)
        .is_some_and(|parent| {
            naming::normalized_portable_name(&parent.to_string_lossy())
                == naming::normalized_portable_name(&stem)
        });
    if !has_metadata
        && !parent_matches
        && !is_known_standalone_portable(&stem)
        && !installer_candidate
    {
        return None;
    }
    let parent_name = path
        .parent()
        .and_then(Path::file_name)
        .map(|parent| parent.to_string_lossy().into_owned());
    let name = naming::portable_display_name(
        &stem,
        parent_name.as_deref(),
        metadata.product_name.as_deref(),
    );
    let mut app = make_app(name, path.clone());
    app.source_kind = SourceKind::Portable;
    app.description = metadata.description;
    app.version = metadata
        .version
        .or_else(|| naming::portable_version_from_stem(&stem));
    app.publisher = metadata.publisher;
    app.product_name = metadata.product_name;
    app.original_filename = metadata.original_filename;
    app.artifact_kind = artifact::classify(&app, metadata.internal_name.as_deref(), facts);
    if app.artifact_kind == ArtifactKind::Application
        && filters::is_maintenance_entry(&app.name, &path.to_string_lossy(), None)
    {
        return None;
    }
    if app.artifact_kind != ArtifactKind::Application {
        app.category = AppCategory::InstallersDocs;
    }
    app.install_location = path
        .parent()
        .map(|value| value.to_string_lossy().into_owned());
    Some(app)
}

fn is_known_standalone_portable(stem: &str) -> bool {
    let normalized = naming::normalized_portable_name(stem);
    [
        "rufus",
        "putty",
        "winscp",
        "ventoy",
        "crystaldiskinfo",
        "crystaldiskmark",
        "cpu z",
        "gpu z",
        "hwinfo",
        "memtest",
        "processhacker",
        "processexplorer",
    ]
    .iter()
    .any(|known| normalized == naming::normalized_portable_name(known))
        || normalized.starts_with("rufus")
        || normalized.starts_with("putty")
        || normalized.starts_with("winscp")
        || normalized.starts_with("ventoy")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn portable_app(path: PathBuf) -> Option<AppInfo> {
        super::portable_app(path, &machine::MachineFacts::empty())
    }

    #[test]
    fn includes_known_standalone_portable_without_metadata() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("Tools").join("rufus-4.11p.exe");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, []).unwrap();

        let app = portable_app(path.clone()).expect("rufus should be detected");

        assert_eq!(app.name, "rufus");
        assert_eq!(app.path, path.to_string_lossy());
        assert_eq!(app.source_kind, SourceKind::Portable);
    }

    #[test]
    fn rejects_unknown_orphan_executable_without_metadata() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("Tools").join("helper-tool.exe");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, []).unwrap();

        assert!(portable_app(path).is_none());
    }
}
