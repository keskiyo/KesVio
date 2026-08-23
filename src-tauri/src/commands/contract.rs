use crate::app_state::{cached_app, preview_for, UninstallRecord};
use crate::catalog::hydration::AppHydrationPatch;
use crate::catalog::sync::{compute_delta, CatalogDeltaDto};
use crate::catalog::{AppDetails, AppInfo, ScanProgress, SourceKind, UninstallTarget};
use crate::error::AppError;
use crate::platform::windows::uninstall_history::{UninstallHistoryEntry, UninstallResult};
use crate::platform::windows::uninstaller::UninstallMechanism;
use crate::platform::windows::{AppArchitecture, AppSignatureStatus};
use serde::Serialize;
use serde_json::{json, Value};
use std::path::PathBuf;

const UPDATE_ENV: &str = "WINDOWSAPPS_CONTRACT_UPDATE";

fn wire(value: impl Serialize) -> Value {
    serde_json::to_value(value).expect("every IPC payload serializes")
}

fn sample_app() -> AppInfo {
    let mut app = cached_app("Visual Studio Code", r"C:\Program Files\Code\Code.exe");
    app.id = "editor".into();
    app.icon_base64 = Some("data:image/png;base64,sample".into());
    app.description = Some("Code editing. Redefined.".into());
    app.version = Some("1.95.0".into());
    app.publisher = Some("Microsoft Corporation".into());
    app.product_name = Some("Visual Studio Code".into());
    app.original_filename = Some("Code.exe".into());
    app.install_location = Some(r"C:\Program Files\Code".into());
    app.can_uninstall = true;
    app.uninstall = Some(UninstallTarget::Command {
        executable: r"C:\Program Files\Code\unins000.exe".into(),
        arguments: "/SILENT".into(),
    });
    app.resolved_path = Some(r"C:\Program Files\Code\Code.exe".into());
    app.shortcut_icon_path = Some(r"C:\Program Files\Code\Code.exe".into());
    app.launch_arguments = Some("--new-window".into());
    app.canonical_identity = Some("identity:microsoft-visual-studio-code".into());
    app.preference_identity = Some("preference:microsoft-visual-studio-code".into());
    app.visibility_reasons = vec![crate::catalog::VisibilityReason::RegisteredProduct];
    app.target_availability = Some("present".into());
    app.category_reasons = vec!["executable_product_match".into()];
    app.close_risk = Some("safe".into());
    app
}

fn commands(app: &AppInfo) -> Value {
    let scan = super::catalog::scan_result_sample(app);
    json!({
        "get_apps": wire(super::catalog::snapshot_sample(app)),
        "refresh_apps": wire(&scan),
        "force_full_scan": wire(&scan),
        "reset_catalog_cache": wire(scan),
        "get_app_details": wire(AppDetails {
            file_size_bytes: Some(184_320),
            file_created_at: Some(1_700_000_000),
            file_modified_at: Some(1_700_000_100),
            architecture: AppArchitecture::X64,
            signature: AppSignatureStatus::Verified,
            executable_exists: Some(true),
            install_location_exists: Some(true),
            can_open_folder: true,
        }),
        "get_uninstall_preview": wire(preview_for(&UninstallRecord {
            app_name: "Visual Studio Code".into(),
            publisher: Some("Microsoft Corporation".into()),
            source_kind: SourceKind::Registry,
            target: UninstallTarget::Msix {
                package_full_name: "Microsoft.Code_1.95.0.0_x64__8wekyb3d8bbwe".into(),
            },
        })),
        "close_apps": wire(super::close::response_sample()),
        "get_uninstall_history": wire(vec![UninstallHistoryEntry {
            id: "editor".into(),
            timestamp: 1_700_000_200,
            app_name: "Visual Studio Code".into(),
            publisher: Some("Microsoft Corporation".into()),
            mechanism: UninstallMechanism::RegisteredCommand,
            result: UninstallResult::Succeeded,
        }]),
        "get_system_settings": wire(super::settings::settings_sample()),
        "set_scan_settings": wire(crate::catalog::scan_settings::ScanSettings::default()),
        "stale_copy_status": wire(super::links::stale_copy_sample()),
        "save_preferences_backup": wire(true),
    })
}

fn events(app: &AppInfo) -> Value {
    let delta = compute_delta(7, &[], std::slice::from_ref(app));
    json!({
        "catalog://delta": wire(CatalogDeltaDto::from(&delta)),
        "catalog://changed": wire(&delta.summary),
        "catalog://patches": wire(vec![AppHydrationPatch {
            id: "editor".into(),
            generation: 7,
            icon_base64: Some("data:image/png;base64,sample".into()),
            description: Some("Code editing. Redefined.".into()),
            version: Some("1.95.0".into()),
            publisher: Some("Microsoft Corporation".into()),
            product_name: Some("Visual Studio Code".into()),
            original_filename: Some("Code.exe".into()),
            install_location: Some(r"C:\Program Files\Code".into()),
            can_uninstall: Some(true),
        }]),
        "catalog://diagnostics": wire(crate::catalog::cache::CatalogDiagnostics::default()),
        "scan://progress": wire(ScanProgress {
            stage: "Windows applications".into(),
            location: Some(r"C:\Program Files".into()),
            completed_roots: 1,
            total_roots: 3,
        }),
        "launch://status": wire(super::launch::status_sample()),
        "close://progress": super::close::progress_sample(),
    })
}

fn contract() -> Value {
    let app = sample_app();
    json!({
        "commands": commands(&app),
        "events": events(&app),
        "error": wire(AppError::LaunchUnavailable),
    })
}

fn shape(value: &Value, path: &str, into: &mut Vec<String>) {
    match value {
        Value::Object(fields) => {
            for (key, field) in fields {
                shape(field, &format!("{path}.{key}"), into);
            }
        }
        Value::Array(items) => match items.first() {
            Some(first) => shape(first, &format!("{path}[]"), into),
            None => into.push(format!("{path}[]: empty")),
        },
        Value::Null => into.push(format!("{path}: null")),
        Value::Bool(_) => into.push(format!("{path}: boolean")),
        Value::Number(_) => into.push(format!("{path}: number")),
        Value::String(_) => into.push(format!("{path}: string")),
    }
}

fn shape_of(value: &Value) -> Vec<String> {
    let mut paths = Vec::new();
    shape(value, "", &mut paths);
    paths.sort();
    paths
}

fn fixture_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
        .join("ipc")
        .join("contract.json")
}

fn difference(baseline: &[String], current: &[String]) -> Vec<String> {
    let mut report = Vec::new();
    for path in current {
        if !baseline.contains(path) {
            report.push(format!("+ {path}"));
        }
    }
    for path in baseline {
        if !current.contains(path) {
            report.push(format!("- {path}"));
        }
    }
    report
}

#[test]
fn the_ipc_wire_shape_matches_its_recorded_contract() {
    let current = contract();
    let path = fixture_path();

    if std::env::var_os(UPDATE_ENV).is_some() {
        std::fs::create_dir_all(path.parent().expect("the fixture has a directory"))
            .unwrap_or_else(|error| panic!("cannot create {}: {error}", path.display()));
        let json = serde_json::to_string_pretty(&current).expect("the contract serializes");
        std::fs::write(&path, format!("{json}\n"))
            .unwrap_or_else(|error| panic!("cannot write {}: {error}", path.display()));
        return;
    }

    let bytes = std::fs::read(&path).unwrap_or_else(|error| {
        panic!(
            "no recorded contract at {} ({error}). Record one with {UPDATE_ENV}=1 and review the diff before committing it.",
            path.display()
        )
    });
    let baseline: Value = serde_json::from_slice(&bytes)
        .unwrap_or_else(|error| panic!("{} does not parse: {error}", path.display()));

    let report = difference(&shape_of(&baseline), &shape_of(&current));
    assert!(
        report.is_empty(),
        "the IPC wire shape changed. Synchronize the TypeScript type, its client method and every \
         full-interface fake before recording the new contract with {UPDATE_ENV}=1:\n  {}",
        report.join("\n  ")
    );
}

#[test]
fn a_renamed_field_is_reported_as_a_contract_change() {
    let baseline = json!({ "commands": { "get_apps": { "hasCache": true } } });
    let renamed = json!({ "commands": { "get_apps": { "cached": true } } });

    let report = difference(&shape_of(&baseline), &shape_of(&renamed));

    assert_eq!(report.len(), 2, "{report:?}");
    assert!(report
        .iter()
        .any(|line| line.contains("+ .commands.get_apps.cached")));
    assert!(report
        .iter()
        .any(|line| line.contains("- .commands.get_apps.hasCache")));
}
