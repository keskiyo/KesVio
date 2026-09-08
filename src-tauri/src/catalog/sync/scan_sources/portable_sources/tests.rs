use super::*;
use std::path::Path;

fn settings(auto_scan_fixed_drives: bool, included_paths: Vec<String>) -> ScanSettings {
    ScanSettings {
        auto_scan_fixed_drives,
        included_paths,
        ..ScanSettings::default()
    }
}

#[test]
fn startup_keeps_cached_apps_when_a_drive_is_temporarily_absent() {
    let previous = (0..170)
        .map(|index| {
            let mut app = super::super::super::app(&format!("app-{index}"), "Editor");
            let drive = if index < 140 { "C" } else { "Q" };
            app.path = format!(r"{drive}:\Portable\Editor-{index}.exe");
            app.source_kind = crate::catalog::SourceKind::Portable;
            app
        })
        .collect::<Vec<_>>();
    let roots = roots_for(
        &settings(true, Vec::new()),
        SyncRequest::Startup,
        vec![PathBuf::from(r"C:\")],
        &previous,
        |path| path == Path::new(r"C:\"),
    );
    let scanned = portable::scan_roots(
        portable::PortableScanInput {
            previous_apps: &previous,
            previous_index: &FilesystemIndex::default(),
            roots: &roots.scanned,
            retained_roots: &roots.retained,
            excluded: &[],
            mode: ScanMode::Incremental,
            max_duration: std::time::Duration::from_secs(1),
            verify_fingerprints: true,
            steps: &StepTracker::default(),
        },
        &|_| {},
        &|| false,
    );
    assert_eq!(scanned.apps.len(), 170);
}

#[test]
fn refresh_scans_explicit_roots_and_retains_fixed_drives() {
    let explicit = tempfile::tempdir().unwrap();
    let fixed = PathBuf::from(r"D:\");
    let roots = roots_for(
        &settings(true, vec![explicit.path().to_string_lossy().into_owned()]),
        SyncRequest::Refresh,
        vec![fixed.clone()],
        &[],
        |path| path.is_dir(),
    );

    assert_eq!(roots.scanned, vec![explicit.path().to_path_buf()]);
    assert_eq!(roots.retained, vec![fixed]);
}

#[test]
fn force_scan_removes_an_explicit_root_nested_under_a_fixed_drive() {
    let fixed = tempfile::tempdir().unwrap();
    let explicit = fixed.path().join("Tools");
    std::fs::create_dir_all(&explicit).unwrap();
    let roots = roots_for(
        &settings(true, vec![explicit.to_string_lossy().into_owned()]),
        SyncRequest::Force,
        vec![fixed.path().to_path_buf()],
        &[],
        |path| path.is_dir(),
    );

    assert_eq!(roots.scanned, vec![fixed.path().to_path_buf()]);
    assert!(roots.retained.is_empty());
}

#[test]
fn disabled_fixed_drive_scanning_neither_scans_nor_retains_fixed_drives() {
    let fixed = PathBuf::from(r"D:\");
    let roots = roots_for(
        &settings(false, Vec::new()),
        SyncRequest::Refresh,
        vec![fixed],
        &[],
        |path| path.is_dir(),
    );

    assert!(roots.scanned.is_empty());
    assert!(roots.retained.is_empty());
}

#[test]
fn only_a_cancelled_portable_scan_throws_away_what_it_found() {
    assert!(adopts_results(None));
    assert!(adopts_results(Some(StageStop::TimedOut)));
    assert!(adopts_results(Some(StageStop::EntryLimit)));
    assert!(!adopts_results(Some(StageStop::Cancelled)));
}
