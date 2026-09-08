use super::*;
use crate::catalog::incremental::{DirectoryRecord, FilesystemIndex, ScanMode};
use crate::catalog::sync::scan_control::StageStop;
use crate::catalog::{AppCategory, AppInfo, LaunchKind, SourceKind, VisibilityClass};
use std::collections::BTreeMap;
use std::path::Path;
use std::time::Duration;

fn app(id: &str, path: &str) -> AppInfo {
    AppInfo {
        id: id.into(),
        name: id.into(),
        path: path.into(),
        icon_base64: None,
        artifact_kind: Default::default(),
        category: AppCategory::Other,
        launch_kind: LaunchKind::Executable,
        source_kind: SourceKind::Portable,
        description: None,
        version: None,
        publisher: None,
        product_name: None,
        original_filename: None,
        install_location: Path::new(path)
            .parent()
            .map(|value| value.to_string_lossy().into_owned()),
        can_uninstall: false,
        resolved_path: None,
        shortcut_icon_path: None,
        launch_arguments: None,
        canonical_identity: None,
        preference_identity: None,
        visibility_class: VisibilityClass::Primary,
        visibility_score: 20,
        visibility_reasons: Vec::new(),
        target_availability: None,
        category_reasons: Vec::new(),
        close_risk: None,
    }
}

#[test]
fn retained_unavailable_root_applies_exclusions_without_dropping_other_apps() {
    let previous = vec![
        app("excluded", r"Q:\Portable\Private\Tool.exe"),
        app("kept", r"Q:\Portable\Kept.exe"),
    ];
    for mode in [ScanMode::Incremental, ScanMode::Force] {
        let scanned = scan_roots(
            PortableScanInput {
                previous_apps: &previous,
                previous_index: &FilesystemIndex::default(),
                roots: &[],
                retained_roots: &[PathBuf::from(r"Q:\Portable")],
                excluded: &[PathBuf::from(r"q:\portable\private")],
                mode,
                max_duration: Duration::from_secs(10),
                verify_fingerprints: true,
                steps: &StepTracker::default(),
            },
            &|_| {},
            &|| false,
        );

        assert_eq!(
            scanned
                .apps
                .iter()
                .map(|app| app.id.as_str())
                .collect::<Vec<_>>(),
            vec!["kept"]
        );
    }
}

#[test]
fn incomplete_root_keeps_previous_apps_and_overlays_new_results() {
    let root = Path::new(r"D:\Apps");
    let previous = vec![
        app("same", r"D:\Apps\Old.exe"),
        app("kept", r"D:\Apps\Kept.exe"),
    ];
    let scanned = vec![app("same", r"D:\Apps\New.exe")];

    let merged = merge_root_apps(&previous, scanned, root, false);

    assert_eq!(
        merged.iter().map(|app| app.id.as_str()).collect::<Vec<_>>(),
        vec!["kept", "same"]
    );
    assert_eq!(
        merged.iter().find(|app| app.id == "same").unwrap().path,
        r"D:\Apps\New.exe"
    );
}

#[test]
fn completed_root_replaces_stale_apps() {
    let root = Path::new(r"D:\Apps");
    let previous = vec![app("stale", r"D:\Apps\Stale.exe")];

    assert!(merge_root_apps(&previous, Vec::new(), root, true).is_empty());
}

#[test]
fn removed_scan_root_does_not_keep_previous_apps() {
    let previous = vec![app("removed-root", r"E:\Portable\Tool.exe")];

    assert!(merge_root_apps(&previous, Vec::new(), Path::new(r"D:\Apps"), false,).is_empty());
}

#[test]
fn incomplete_root_keeps_previous_index_records() {
    let root = Path::new(r"D:\Apps");
    let previous = FilesystemIndex {
        directories: BTreeMap::from([(
            r"d:\apps\kept".into(),
            DirectoryRecord {
                modified_nanos: 1,
                executables: Default::default(),
                child_directories: Vec::new(),
                apps: vec![app("kept", r"D:\Apps\Kept\kept.exe")],
            },
        )]),
    };

    let merged = merge_root_index(&previous, FilesystemIndex::default(), root, false);

    assert!(merged.directories.contains_key(r"d:\apps\kept"));
}

#[test]
fn retained_root_keeps_apps_without_keeping_its_directory_index() {
    let retained = tempfile::tempdir().unwrap();
    let kept = app("kept", &retained.path().join("Kept.exe").to_string_lossy());
    let previous = vec![kept.clone()];
    let previous_index = FilesystemIndex {
        directories: BTreeMap::from([(
            retained.path().to_string_lossy().to_lowercase(),
            DirectoryRecord {
                modified_nanos: 1,
                child_directories: Vec::new(),
                apps: vec![kept],
                executables: BTreeMap::new(),
            },
        )]),
    };
    let retained_roots = [retained.path().to_path_buf()];

    let scanned = scan_roots(
        PortableScanInput {
            previous_apps: &previous,
            previous_index: &previous_index,
            roots: &[],
            retained_roots: &retained_roots,
            excluded: &[],
            mode: ScanMode::Incremental,
            max_duration: Duration::from_secs(10),
            verify_fingerprints: true,
            steps: &StepTracker::default(),
        },
        &|_| {},
        &|| false,
    );

    assert_eq!(
        scanned
            .apps
            .iter()
            .map(|app| app.id.as_str())
            .collect::<Vec<_>>(),
        vec!["kept"]
    );
    assert!(scanned.filesystem_index.directories.is_empty());
}

#[test]
fn scanned_subtree_replaces_stale_apps_inside_a_retained_root() {
    let retained = tempfile::tempdir().unwrap();
    let scanned_root = retained.path().join("Tools");
    std::fs::create_dir_all(&scanned_root).unwrap();
    let previous = vec![app(
        "stale",
        &scanned_root.join("Stale.exe").to_string_lossy(),
    )];
    let scanned_roots = [scanned_root];
    let retained_roots = [retained.path().to_path_buf()];

    let scanned = scan_roots(
        PortableScanInput {
            previous_apps: &previous,
            previous_index: &FilesystemIndex::default(),
            roots: &scanned_roots,
            retained_roots: &retained_roots,
            excluded: &[],
            mode: ScanMode::Incremental,
            max_duration: Duration::from_secs(10),
            verify_fingerprints: true,
            steps: &StepTracker::default(),
        },
        &|_| {},
        &|| false,
    );

    assert!(scanned.apps.is_empty());
}

#[test]
fn no_retained_roots_drop_previous_apps_outside_scanned_folders() {
    let retained = tempfile::tempdir().unwrap();
    let previous = vec![app(
        "removed",
        &retained.path().join("Removed.exe").to_string_lossy(),
    )];

    let scanned = scan_roots(
        PortableScanInput {
            previous_apps: &previous,
            previous_index: &FilesystemIndex::default(),
            roots: &[],
            retained_roots: &[],
            excluded: &[],
            mode: ScanMode::Incremental,
            max_duration: Duration::from_secs(10),
            verify_fingerprints: true,
            steps: &StepTracker::default(),
        },
        &|_| {},
        &|| false,
    );

    assert!(scanned.apps.is_empty());
}

#[test]
fn zero_total_budget_preserves_every_unvisited_root() {
    let first = tempfile::tempdir().unwrap();
    let second = tempfile::tempdir().unwrap();
    let previous = vec![
        app("first", &first.path().join("First.exe").to_string_lossy()),
        app(
            "second",
            &second.path().join("Second.exe").to_string_lossy(),
        ),
    ];

    let previous_index = FilesystemIndex::default();
    let roots = [first.path().to_path_buf(), second.path().to_path_buf()];
    let scanned = scan_roots(
        PortableScanInput {
            previous_apps: &previous,
            previous_index: &previous_index,
            roots: &roots,
            retained_roots: &[],
            excluded: &[],
            mode: ScanMode::Incremental,
            max_duration: Duration::ZERO,
            verify_fingerprints: true,
            steps: &StepTracker::default(),
        },
        &|_| {},
        &|| false,
    );

    assert_eq!(
        scanned
            .apps
            .iter()
            .map(|app| app.id.as_str())
            .collect::<Vec<_>>(),
        vec!["first", "second"]
    );
    assert_eq!(scanned.stop, Some(StageStop::TimedOut));
}

#[test]
fn shares_the_remaining_time_with_unvisited_roots() {
    assert_eq!(
        root_duration(Duration::from_secs(90), 3),
        Duration::from_secs(30)
    );
    assert_eq!(
        root_duration(Duration::from_secs(91), 2),
        Duration::from_millis(45_500)
    );
}
