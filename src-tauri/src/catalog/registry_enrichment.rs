use super::{dedup, registry, AppInfo};

pub(super) fn attach_registry_metadata(
    apps: &mut [AppInfo],
    metadata: &[registry::RegistryMetadata],
) {
    for app in apps.iter_mut().filter(|app| !app.can_uninstall) {
        let matches = metadata
            .iter()
            .filter(|record| registry_metadata_matches(app, record))
            .collect::<Vec<_>>();
        let Some(first) = matches.first() else {
            continue;
        };
        if !matches
            .iter()
            .all(|record| record.uninstall_signature == first.uninstall_signature)
        {
            continue;
        }
        app.can_uninstall = true;
        if app.description.is_none() {
            app.description = first.description.clone();
        }
        if app.version.is_none() {
            app.version = first.version.clone();
        }
        if app.publisher.is_none() {
            app.publisher = first.publisher.clone();
        }
        if app.install_location.is_none() {
            app.install_location = first
                .install_location
                .clone()
                .filter(|location| dedup::location_holds_target(location, app));
        }
    }
}

fn registry_metadata_matches(app: &AppInfo, record: &registry::RegistryMetadata) -> bool {
    if dedup::normalized_product_family(&app.name) != dedup::normalized_product_family(&record.name)
    {
        return false;
    }
    match (&app.publisher, &record.publisher) {
        (Some(app_publisher), Some(record_publisher)) => {
            app_publisher.eq_ignore_ascii_case(record_publisher)
        }
        _ => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog::{AppCategory, ArtifactKind, LaunchKind, SourceKind};

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

    fn registry_metadata(
        name: &str,
        publisher: Option<&str>,
        executable: &str,
    ) -> registry::RegistryMetadata {
        registry::RegistryMetadata {
            name: name.into(),
            description: None,
            version: None,
            publisher: publisher.map(String::from),
            install_location: None,
            uninstall_signature: format!("{executable}\u{1f}"),
        }
    }

    #[test]
    fn attaches_registered_uninstall_to_matching_shortcut() {
        let mut apps = vec![app("Steam", r"C:\Menu\Steam.lnk")];
        apps[0].launch_kind = LaunchKind::Shortcut;
        attach_registry_metadata(
            &mut apps,
            &[registry_metadata(
                "Steam",
                Some("Valve"),
                r"C:\Steam\uninstall.exe",
            )],
        );
        assert!(apps[0].can_uninstall);
        assert_eq!(apps[0].publisher.as_deref(), Some("Valve"));
    }

    #[test]
    fn attaches_version_labelled_registry_entry_to_plain_shortcut_name() {
        let mut apps = vec![app("Ollama", r"C:\Menu\Ollama.lnk")];
        attach_registry_metadata(
            &mut apps,
            &[registry_metadata(
                "Ollama version 0.24.0",
                Some("Ollama"),
                r"C:\Ollama\unins000.exe",
            )],
        );
        assert!(apps[0].can_uninstall);
    }

    #[test]
    fn does_not_attach_ambiguous_uninstall_commands() {
        let mut apps = vec![app("Studio", r"C:\Menu\Studio.lnk")];
        attach_registry_metadata(
            &mut apps,
            &[
                registry_metadata("Studio", None, r"C:\Alpha\uninstall.exe"),
                registry_metadata("Studio", None, r"C:\Beta\uninstall.exe"),
            ],
        );
        assert!(!apps[0].can_uninstall);
    }

    #[test]
    fn does_not_attach_metadata_from_a_conflicting_publisher() {
        let mut apps = vec![app("Studio", r"C:\Menu\Studio.lnk")];
        apps[0].publisher = Some("Alpha".into());
        attach_registry_metadata(
            &mut apps,
            &[registry_metadata(
                "Studio",
                Some("Beta"),
                r"C:\Beta\uninstall.exe",
            )],
        );
        assert!(!apps[0].can_uninstall);
    }
}
