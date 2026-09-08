use crate::catalog::sync::scan_control::ScanControl;
use crate::catalog::{
    classify::classify, filters::is_invalid_display_name, stable_id, AppInfo, LaunchKind,
    SourceKind,
};
use crate::platform::windows::apps_folder::{self, StartAppEntry};
use crate::platform::windows::package_registry;
use std::collections::HashMap;

mod package;

pub(in crate::catalog) fn scan(control: &ScanControl) -> Option<Vec<AppInfo>> {
    let _operation = crate::diagnostics::Operation::start("start-apps scan");
    if control.is_cancelled() {
        return None;
    }
    control.step(
        crate::catalog::source::START_APPS_SOURCE,
        "Shell enumeration",
    );
    let entries = apps_folder::start_apps(&|| control.is_cancelled(), &|detail| {
        control.step(crate::catalog::source::START_APPS_SOURCE, detail)
    })?;
    log::info!("Apps folder enumerated: {} entries", entries.len());
    control.step(
        crate::catalog::source::START_APPS_SOURCE,
        "package executable registry",
    );
    let executables = package_registry::packaged_executables();
    control.step(
        crate::catalog::source::START_APPS_SOURCE,
        "machine facts and entry conversion",
    );
    let apps = build_start_apps(entries, &executables);
    control.step(
        crate::catalog::source::START_APPS_SOURCE,
        "conversion returned",
    );
    log::info!("Start-apps converted: records={}", apps.len());
    Some(apps)
}

fn build_start_apps(
    entries: Vec<StartAppEntry>,
    executables: &HashMap<String, String>,
) -> Vec<AppInfo> {
    let facts = crate::catalog::machine::MachineFacts::current();
    entries
        .into_iter()
        .enumerate()
        .filter_map(|(index, entry)| {
            log::info!(
                "Start-apps entry: index={index} id={} packaged={} targetPresent={}",
                stable_id(&entry.app_id),
                entry.package.is_some(),
                entry.target.is_some()
            );
            let name = entry.name.trim().to_string();
            let app_id = entry.app_id.trim().to_string();
            let resolved_path = entry
                .target
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string);
            if is_invalid_display_name(&name) || app_id.is_empty() {
                log::info!(
                    "Start-apps entry skipped: index={index} invalid identity or display name"
                );
                return None;
            }
            let mut app = AppInfo {
                id: stable_id(&app_id),
                category: classify(&name, &app_id),
                name,
                path: app_id,
                icon_base64: None,
                artifact_kind: Default::default(),
                launch_kind: LaunchKind::AppUserModelId,
                source_kind: SourceKind::StartApps,
                description: None,
                version: None,
                publisher: None,
                product_name: None,
                original_filename: None,
                install_location: None,
                can_uninstall: false,
                resolved_path,
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
            if let Some(identity) = entry.package.as_ref() {
                package::apply(&mut app, identity, executables);
            }
            app.artifact_kind = crate::catalog::artifact::classify(&app, None, &facts);
            if app.artifact_kind != crate::catalog::ArtifactKind::Application {
                app.category = crate::catalog::AppCategory::InstallersDocs;
            }
            log::info!(
                "Start-apps entry converted: index={index} artifact={:?}",
                app.artifact_kind
            );
            Some(app)
        })
        .collect()
}

#[cfg(test)]
mod tests;
