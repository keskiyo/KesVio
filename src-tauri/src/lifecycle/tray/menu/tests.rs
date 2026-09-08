use super::*;

#[test]
fn tray_menu_ids_map_to_explicit_actions() {
    assert_eq!(tray_action("open"), Some(TrayAction::Open));
    assert_eq!(tray_action("quit"), Some(TrayAction::Quit));
    assert_eq!(tray_action("unknown"), None);
    assert_eq!(
        tray_action("force-full-scan"),
        Some(TrayAction::ForceFullScan)
    );
}

#[test]
fn a_scenario_menu_id_carries_the_scenario_it_runs() {
    assert_eq!(
        tray_action("scenario:custom:42"),
        Some(TrayAction::RunScenario("custom:42".into()))
    );
}

#[test]
fn a_scenario_menu_id_without_a_usable_id_is_ignored() {
    assert_eq!(tray_action("scenario:"), None);
    assert_eq!(
        tray_action(&format!(
            "scenario:{}",
            "a".repeat(MAX_SCENARIO_ID_CHARS + 1)
        )),
        None
    );
}

#[test]
fn a_label_never_reaches_the_menu_as_a_mnemonic_or_a_control_sequence() {
    assert_eq!(sanitize_label("Work & Play"), "Work && Play");
    assert_eq!(sanitize_label("Work\r\n\tPlay"), "Work Play");
    assert_eq!(sanitize_label("   "), FALLBACK_LABEL);
    assert_eq!(sanitize_label(""), FALLBACK_LABEL);
}

fn entry(label: &str, favorite: bool) -> TrayScenario {
    TrayScenario {
        id: "custom:1".into(),
        label: label.into(),
        favorite,
    }
}

// A filled and a hollow star are a matched pair of the same width, so every name in the
// submenu starts at one column instead of the starred ones sitting two glyphs to the right.
#[test]
fn a_marked_menu_starts_every_name_at_one_column() {
    assert_eq!(menu_label(&entry("Gaming", true), true), "★ Gaming");
    assert_eq!(menu_label(&entry("Work", false), true), "☆ Work");
}

// With nothing starred the column would carry no information and every row would wear a
// hollow star for it.
#[test]
fn an_unmarked_menu_shows_the_names_alone() {
    assert_eq!(menu_label(&entry("Gaming", false), false), "Gaming");
}

// The mark is what the row is recognised by, so truncation must never be what removes it.
#[test]
fn a_starred_long_name_keeps_the_mark_and_loses_the_tail() {
    let label = menu_label(&entry(&"a".repeat(MAX_LABEL_CHARS * 2), true), true);

    assert!(label.starts_with(FAVORITE_MARK));
    assert!(label.ends_with('…'));
}

#[test]
fn a_scenario_that_omits_the_favorite_flag_is_read_as_unstarred() {
    let parsed: TrayScenario = serde_json::from_str(r#"{"id":"custom:1","label":"Gaming"}"#)
        .expect("the entry parses without the flag");

    assert!(!parsed.favorite);
    assert_eq!(menu_label(&parsed, false), "Gaming");
}

#[test]
fn a_long_label_is_truncated_to_a_readable_menu_width() {
    let label = sanitize_label(&"a".repeat(MAX_LABEL_CHARS * 2));

    assert_eq!(label.chars().count(), MAX_LABEL_CHARS);
    assert!(label.ends_with('…'));
}
