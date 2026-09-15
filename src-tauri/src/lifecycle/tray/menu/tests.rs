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
    assert_eq!(tray_action("search"), Some(TrayAction::Search));
    assert_eq!(
        tray_action("show-favorites"),
        Some(TrayAction::ShowFavorites)
    );
    assert_eq!(tray_action("catalog-status"), None);
    assert_eq!(tray_action("pause:30"), None);
    assert_eq!(tray_action("resume-scans"), None);
}

#[test]
fn a_favorite_menu_id_carries_the_catalog_id_it_launches() {
    assert_eq!(
        tray_action("favorite:path:c:\\tools\\editor.exe"),
        Some(TrayAction::LaunchApp("path:c:\\tools\\editor.exe".into()))
    );
    assert_eq!(tray_action("favorite:"), None);
    assert_eq!(
        tray_action(&format!(
            "favorite:{}",
            "a".repeat(MAX_SCENARIO_ID_CHARS + 1)
        )),
        None
    );
}

fn favorite(label: &str) -> TrayFavorite {
    TrayFavorite {
        id: label.to_lowercase(),
        label: label.into(),
    }
}

// Two favorites with the same display name would be two identical rows with different
// targets; a position suffix keeps each row tied to what it launches.
#[test]
fn identical_favorite_names_stay_distinguishable() {
    let labels = favorite_labels(&[favorite("Editor"), favorite("Editor"), favorite("Tool")]);

    assert_eq!(labels, vec!["Editor (1)", "Editor (2)", "Tool"]);
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

// The tray copy is the one the user learned and the one the documentation names; a change here is
// a deliberate edit of this test, never a side effect of a refactor.
#[test]
fn the_tray_copy_is_pinned() {
    assert_eq!(OPEN_LABEL, "Open KesVio");
    assert_eq!(SEARCH_LABEL, "Search");
    assert_eq!(FAVORITES_LABEL, "Favorite apps");
    assert_eq!(SHOW_ALL_FAVORITES_LABEL, "Show all favorites…");
    assert_eq!(SCENARIOS_LABEL, "Scenarios");
    assert_eq!(QUIT_LABEL, "Quit");
    assert_eq!(super::super::scan::label(false), "Force scan");
    assert_eq!(super::super::scan::label(true), "Scanning…");
}

#[test]
fn a_long_label_is_truncated_to_a_readable_menu_width() {
    let label = sanitize_label(&"a".repeat(MAX_LABEL_CHARS * 2));

    assert_eq!(label.chars().count(), MAX_LABEL_CHARS);
    assert!(label.ends_with('…'));
}
