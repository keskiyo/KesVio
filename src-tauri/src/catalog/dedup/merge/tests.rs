use super::*;
use crate::catalog::{AppCategory, ArtifactKind, LaunchKind, VisibilityClass, VisibilityReason};

fn app(reasons: Vec<VisibilityReason>) -> AppInfo {
    AppInfo {
        id: "app".into(),
        name: "Example".into(),
        path: r"C:\Apps\Example\example.exe".into(),
        icon_base64: None,
        artifact_kind: Default::default(),
        category: AppCategory::Other,
        launch_kind: LaunchKind::Executable,
        source_kind: SourceKind::Registry,
        description: None,
        version: None,
        publisher: None,
        product_name: None,
        original_filename: None,
        install_location: Some(r"C:\Apps\Example".into()),
        can_uninstall: false,
        resolved_path: None,
        shortcut_icon_path: None,
        launch_arguments: None,
        canonical_identity: None,
        preference_identity: None,
        visibility_class: VisibilityClass::Primary,
        visibility_score: 50,
        visibility_reasons: reasons,
        target_availability: None,
        category_reasons: Vec::new(),
        close_risk: None,
        scan_folder: None,
        volume_id: None,
    }
}

#[test]
fn a_same_target_sticky_reason_sets_visibility_before_cache_reload() {
    let mut card = app(Vec::new());
    card.resolved_path = Some(r"C:\Windows\System32\cmd.exe".into());
    let mut secondary = app(vec![VisibilityReason::CommandEnvironment]);
    secondary.resolved_path = card.resolved_path.clone();
    secondary.visibility_class = VisibilityClass::Auxiliary;

    let merged = merge_app(card, secondary);

    assert!(merged
        .visibility_reasons
        .contains(&VisibilityReason::CommandEnvironment));
    assert_eq!(merged.visibility_class, VisibilityClass::Auxiliary);
    let restored =
        serde_json::from_slice::<AppInfo>(&serde_json::to_vec(&merged).unwrap()).unwrap();
    let reloaded = crate::catalog::sanitize(vec![restored]);
    assert_eq!(reloaded.len(), 1);
    assert_eq!(reloaded[0].visibility_class, merged.visibility_class);
}

#[test]
fn merged_card_does_not_inherit_non_sticky_visibility_reasons() {
    let primary = app(Vec::new());
    let secondary = app(vec![VisibilityReason::DocumentationShortcut]);

    let merged = merge_app(primary, secondary);

    assert!(!merged
        .visibility_reasons
        .contains(&VisibilityReason::DocumentationShortcut));
}

#[test]
fn a_siblings_component_reason_does_not_demote_a_registered_card() {
    let mut card = app(Vec::new());
    card.source_kind = SourceKind::StartMenu;
    card.path = r"C:\Menu\Visual Studio Code.lnk".into();
    card.resolved_path = Some(r"D:\Microsoft VS Code\Code.exe".into());
    card.visibility_score = 85;
    let mut component = app(vec![VisibilityReason::ProductComponent]);
    component.path = r"D:\Microsoft VS Code\resources\app\vsce-sign.exe".into();
    component.visibility_class = VisibilityClass::Auxiliary;

    let merged = merge_app(card, component);

    assert_eq!(merged.visibility_class, VisibilityClass::Primary);
    assert!(!merged
        .visibility_reasons
        .contains(&VisibilityReason::ProductComponent));
}

#[test]
fn the_cards_own_sticky_reason_still_survives_a_promotion() {
    let mut prompt = app(vec![VisibilityReason::CommandEnvironment]);
    prompt.visibility_class = VisibilityClass::Auxiliary;
    let mut aumid_sibling = app(Vec::new());
    aumid_sibling.launch_kind = LaunchKind::AppUserModelId;
    aumid_sibling.visibility_class = VisibilityClass::Primary;

    let merged = merge_app(prompt, aumid_sibling);

    assert_eq!(merged.visibility_class, VisibilityClass::Auxiliary);
}

#[test]
fn merged_card_preserves_artifact_kind_and_reserved_category() {
    let primary = app(Vec::new());
    let mut secondary = app(Vec::new());
    secondary.artifact_kind = ArtifactKind::Installer;

    let merged = merge_app(primary, secondary);

    assert_eq!(merged.artifact_kind, ArtifactKind::Installer);
    assert_eq!(merged.category, AppCategory::InstallersDocs);
}

#[test]
fn a_registered_winner_keeps_the_matching_portable_scan_folder() {
    let mut shortcut = app(Vec::new());
    shortcut.source_kind = SourceKind::StartMenu;
    shortcut.launch_kind = LaunchKind::Shortcut;
    shortcut.path = r"C:\Menu\Example.lnk".into();
    shortcut.resolved_path = Some(r"F:\Tools\Example\example.exe".into());
    let mut portable = app(Vec::new());
    portable.source_kind = SourceKind::Portable;
    portable.path = r"F:\Tools\Example\example.exe".into();
    portable.scan_folder = Some(r"F:\".into());

    let merged = merge_app(shortcut, portable);

    assert_eq!(merged.source_kind, SourceKind::StartMenu);
    assert_eq!(merged.scan_folder.as_deref(), Some(r"F:\"));
}

#[test]
fn a_scan_folder_from_another_copy_is_not_adopted() {
    let mut shortcut = app(Vec::new());
    shortcut.source_kind = SourceKind::StartMenu;
    shortcut.launch_kind = LaunchKind::Shortcut;
    shortcut.path = r"C:\Menu\Example.lnk".into();
    shortcut.resolved_path = Some(r"D:\Apps\Example\example.exe".into());
    let mut portable = app(Vec::new());
    portable.source_kind = SourceKind::Portable;
    portable.path = r"F:\Tools\Example\example.exe".into();
    portable.scan_folder = Some(r"F:\".into());

    let merged = merge_app(shortcut, portable);

    assert_eq!(merged.scan_folder, None);
}
