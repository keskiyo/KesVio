use crate::catalog::sync::scan_control::{StageBudget, StageStop};
use crate::catalog::{
    classify::classify, filters::clean_display_icon, find_executable_named, stable_id, AppInfo,
    LaunchKind, SourceKind,
};
use crate::platform::windows::uninstall_registry;
pub(in crate::catalog) use crate::platform::windows::uninstall_registry::RegistryEntry as RegistryValues;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(in crate::catalog) struct RegistryMetadata {
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub publisher: Option<String>,
    pub install_location: Option<String>,
    pub uninstall_signature: String,
}

#[derive(Default)]
pub(in crate::catalog) struct RegistryScan {
    pub apps: Vec<AppInfo>,
    pub metadata: Vec<RegistryMetadata>,
    pub stop: Option<StageStop>,
    pub complete: bool,
}

pub(in crate::catalog) fn scan(budget: &StageBudget) -> RegistryScan {
    let mut result = RegistryScan::default();
    if budget.should_stop() {
        result.stop = budget.stop();
        return result;
    }
    let facts = crate::catalog::machine::MachineFacts::current();
    let entries = uninstall_registry::entries();
    log::info!(
        "Registry uninstall entries read: {} complete={}",
        entries.entries.len(),
        entries.complete
    );
    result.complete = entries.complete;
    for values in entries.entries.into_iter().map(expand_registry_paths) {
        if !budget.charge_entry() {
            break;
        }
        budget.step(
            crate::catalog::source::REGISTRY_SOURCE,
            &values.display_name,
        );
        if let Some(metadata) = metadata_from_values(&values) {
            result.metadata.push(metadata);
        }
        if let Some(app) = from_values(values, &facts) {
            result.apps.push(app);
        }
    }
    result.stop = budget.stop();
    result
}

pub(in crate::catalog) fn from_values(
    values: RegistryValues,
    facts: &crate::catalog::machine::MachineFacts,
) -> Option<AppInfo> {
    if values.system_component {
        return None;
    }
    let path = values
        .display_icon
        .as_deref()
        .and_then(clean_display_icon)
        .filter(|path| {
            crate::catalog::is_launchable(path)
                && !crate::catalog::filters::is_uninstall_target_path(path)
                && !crate::catalog::filters::is_noise(&values.display_name, &path.to_string_lossy())
        })
        .or_else(|| {
            values
                .install_location
                .as_deref()
                .and_then(|location| find_executable_named(location, Some(&values.display_name)))
        })?;
    let path_text = path.to_string_lossy().trim().to_string();
    if values.display_name.trim().is_empty()
        || crate::catalog::filters::is_noise(&values.display_name, &path_text)
    {
        return None;
    }
    let can_uninstall = uninstall_signature(&values).is_some();
    let name = values.display_name.trim().to_string();
    let executable_metadata = crate::platform::windows::executable_metadata::read(&path);
    let internal_name = executable_metadata.internal_name.clone();
    let mut app = AppInfo {
        id: stable_id(&path_text),
        category: classify(&name, &path_text),
        name,
        path: path_text,
        icon_base64: None,
        artifact_kind: Default::default(),
        launch_kind: if path
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("lnk"))
        {
            LaunchKind::Shortcut
        } else {
            LaunchKind::Executable
        },
        source_kind: SourceKind::Registry,
        description: clean(values.comments).or(executable_metadata.description),
        version: clean(values.display_version).or(executable_metadata.version),
        publisher: clean(values.publisher).or(executable_metadata.publisher),
        product_name: executable_metadata.product_name,
        original_filename: executable_metadata.original_filename,
        install_location: clean(values.install_location),
        can_uninstall,
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
    };
    app.artifact_kind = crate::catalog::artifact::classify(&app, internal_name.as_deref(), facts);
    if app.artifact_kind != crate::catalog::ArtifactKind::Application {
        app.category = crate::catalog::AppCategory::InstallersDocs;
    }
    Some(app)
}

fn metadata_from_values(values: &RegistryValues) -> Option<RegistryMetadata> {
    let name = values.display_name.trim().to_string();
    if name.is_empty() || crate::catalog::filters::is_invalid_display_name(&name) {
        return None;
    }
    Some(RegistryMetadata {
        name,
        description: clean(values.comments.clone()),
        version: clean(values.display_version.clone()),
        publisher: clean(values.publisher.clone()),
        install_location: clean(values.install_location.clone()),
        uninstall_signature: uninstall_signature(values)?,
    })
}

fn uninstall_signature(values: &RegistryValues) -> Option<String> {
    values
        .quiet_uninstall_string
        .as_deref()
        .and_then(split_command)
        .or_else(|| values.uninstall_string.as_deref().and_then(split_command))
        .map(|(executable, arguments)| format!("{executable}\u{1f}{arguments}"))
}

fn expand_registry_paths(mut values: RegistryValues) -> RegistryValues {
    values.display_icon = values
        .display_icon
        .map(|value| crate::platform::windows::exec_target::expand_env(&value));
    values.install_location = values
        .install_location
        .map(|value| crate::platform::windows::exec_target::expand_env(&value));
    values
}

fn clean(value: Option<String>) -> Option<String> {
    value
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}

// Indices come from `find('"')` and from an ASCII `.exe` byte match, never from a lowercase copy.
#[expect(clippy::string_slice)]
fn split_command(value: &str) -> Option<(String, String)> {
    let value = value.trim();
    if let Some(rest) = value.strip_prefix('"') {
        let end = rest.find('"')?;
        return Some((rest[..end].to_string(), rest[end + 1..].trim().to_string()));
    }
    let end = executable_suffix_end(value)?;
    Some((
        value[..end].trim().to_string(),
        value[end..].trim().to_string(),
    ))
}

fn executable_suffix_end(value: &str) -> Option<usize> {
    value
        .as_bytes()
        .windows(4)
        .position(|window| window.eq_ignore_ascii_case(b".exe"))
        .map(|start| start + 4)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn values(display_name: &str, display_icon: Option<String>) -> RegistryValues {
        RegistryValues {
            display_name: display_name.into(),
            display_icon,
            display_version: None,
            publisher: None,
            comments: None,
            install_location: None,
            uninstall_string: None,
            quiet_uninstall_string: None,
            system_component: false,
        }
    }

    fn from_values(values: RegistryValues) -> Option<AppInfo> {
        super::from_values(values, &crate::catalog::machine::MachineFacts::empty())
    }

    #[test]
    fn expands_environment_variables_in_registry_paths() {
        let dir = tempfile::tempdir().unwrap();
        std::env::set_var("WINAPPS_TEST_REG_ROOT", dir.path());
        let raw = values("Editor", Some(r"%WINAPPS_TEST_REG_ROOT%\Editor.exe".into()));

        let expanded = expand_registry_paths(raw);

        assert_eq!(
            expanded.display_icon.as_deref(),
            Some(dir.path().join("Editor.exe").to_string_lossy().as_ref())
        );
    }

    #[test]
    fn an_expanded_registry_path_produces_a_catalog_entry() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("Editor.exe");
        std::fs::write(&executable, []).unwrap();
        std::env::set_var("WINAPPS_TEST_REG_ENTRY_ROOT", dir.path());
        let raw = values(
            "Editor",
            Some(r"%WINAPPS_TEST_REG_ENTRY_ROOT%\Editor.exe".into()),
        );

        assert!(from_values(values(
            "Editor",
            Some(r"%WINAPPS_TEST_REG_ENTRY_ROOT%\Editor.exe".into()),
        ))
        .is_none());

        let app = from_values(expand_registry_paths(raw)).expect("expanded path is launchable");
        assert_eq!(app.name, "Editor");
        assert_eq!(app.path, executable.to_string_lossy());
    }

    #[test]
    fn system_component_is_metadata_only() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("Runtime.exe");
        std::fs::write(&executable, []).unwrap();
        let mut values = values(
            "Runtime component",
            Some(executable.to_string_lossy().into_owned()),
        );
        values.system_component = true;

        assert!(from_values(values).is_none());
    }

    #[test]
    fn rejects_resource_only_display_icon() {
        let dir = tempfile::tempdir().unwrap();
        let icon = dir.path().join("app.ico");
        std::fs::write(&icon, []).unwrap();
        assert!(from_values(values(
            "Icon Resource",
            Some(icon.to_string_lossy().into_owned())
        ))
        .is_none());
    }

    #[test]
    fn registry_record_preserves_metadata_and_uninstall_data() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("Codex.exe");
        std::fs::write(&executable, []).unwrap();
        let app = from_values(RegistryValues {
            display_name: "Codex".into(),
            display_icon: Some(format!("{},0", executable.display())),
            display_version: Some("1.2.3".into()),
            publisher: Some("OpenAI".into()),
            comments: Some("Coding agent".into()),
            install_location: Some(r"C:\Apps".into()),
            uninstall_string: Some(r"C:\Apps\uninstall.exe /remove".into()),
            quiet_uninstall_string: None,
            system_component: false,
        })
        .unwrap();
        assert_eq!(app.version.as_deref(), Some("1.2.3"));
        assert_eq!(app.publisher.as_deref(), Some("OpenAI"));
        assert!(app.can_uninstall);
    }

    #[test]
    fn registry_installer_target_uses_artifact_classification() {
        let dir = tempfile::tempdir().unwrap();
        let cache = dir.path().join("Package Cache").join("{fixture}");
        std::fs::create_dir_all(&cache).unwrap();
        let executable = cache.join("winsdksetup.exe");
        std::fs::write(&executable, []).unwrap();

        let app = from_values(values(
            "Windows Software Development Kit",
            Some(executable.to_string_lossy().into_owned()),
        ))
        .unwrap();

        assert_eq!(app.artifact_kind, crate::catalog::ArtifactKind::Installer);
        assert_eq!(app.category, crate::catalog::AppCategory::InstallersDocs);
    }

    #[test]
    fn quiet_uninstall_command_has_priority() {
        let values = RegistryValues {
            display_name: "App".into(),
            display_icon: None,
            display_version: None,
            publisher: None,
            comments: None,
            install_location: None,
            uninstall_string: Some(r"C:\Apps\uninstall.exe".into()),
            quiet_uninstall_string: Some(r"C:\Apps\uninstall.exe /quiet".into()),
            system_component: false,
        };

        assert_eq!(
            uninstall_signature(&values).as_deref(),
            Some(format!("{}\u{1f}/quiet", r"C:\Apps\uninstall.exe").as_str())
        );
    }

    #[test]
    fn uninstall_is_unavailable_without_a_parsable_command() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("App.exe");
        std::fs::write(&executable, []).unwrap();
        let app = from_values(RegistryValues {
            display_name: "App".into(),
            display_icon: Some(executable.to_string_lossy().into_owned()),
            display_version: None,
            publisher: None,
            comments: None,
            install_location: None,
            uninstall_string: None,
            quiet_uninstall_string: Some("not a command".into()),
            system_component: false,
        })
        .unwrap();
        assert!(!app.can_uninstall);
    }

    #[test]
    fn an_unquoted_command_splits_on_byte_offsets_of_the_value_itself() {
        assert_eq!(
            split_command(r"C:\İnstall\Setup.EXE /silent"),
            Some((r"C:\İnstall\Setup.EXE".into(), "/silent".into()))
        );
        assert_eq!(executable_suffix_end("İ.exe"), Some(6));
        assert_eq!(executable_suffix_end("İ"), None);
    }

    #[test]
    fn splits_quoted_uninstall_command() {
        assert_eq!(
            split_command(r#""C:\Program Files\App\uninstall.exe" /remove"#),
            Some((
                r"C:\Program Files\App\uninstall.exe".into(),
                "/remove".into()
            ))
        );
    }

    #[test]
    fn preserves_uninstall_metadata_when_display_icon_is_the_uninstaller() {
        let values = RegistryValues {
            display_name: "Steam".into(),
            display_icon: Some(r"C:\Program Files (x86)\Steam\uninstall.exe".into()),
            display_version: None,
            publisher: Some("Valve".into()),
            comments: None,
            install_location: None,
            uninstall_string: Some(r"C:\Program Files (x86)\Steam\uninstall.exe".into()),
            quiet_uninstall_string: None,
            system_component: false,
        };
        let metadata = metadata_from_values(&values).unwrap();
        assert_eq!(metadata.name, "Steam");
        assert_eq!(metadata.publisher.as_deref(), Some("Valve"));
        assert_eq!(
            metadata.uninstall_signature,
            format!("{}\u{1f}", r"C:\Program Files (x86)\Steam\uninstall.exe")
        );
        assert!(from_values(values).is_none());
    }
}
