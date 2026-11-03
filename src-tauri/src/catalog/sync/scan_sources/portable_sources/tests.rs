use super::*;
use crate::catalog::volumes::ResolvedFolder;
use std::path::Path;

fn configured(paths: Vec<String>) -> Vec<ResolvedFolder> {
    paths
        .into_iter()
        .map(|path| ResolvedFolder {
            configured: path.clone(),
            path,
            volume: None,
        })
        .collect()
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
        &[],
        true,
        SyncRequest::Startup,
        vec![PathBuf::from(r"C:\")],
        Some(&previous),
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
        &configured(vec![explicit.path().to_string_lossy().into_owned()]),
        true,
        SyncRequest::Refresh,
        vec![fixed.clone()],
        Some(&[]),
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
        &configured(vec![explicit.to_string_lossy().into_owned()]),
        true,
        SyncRequest::Force,
        vec![fixed.path().to_path_buf()],
        Some(&[]),
        |path| path.is_dir(),
    );

    assert_eq!(roots.scanned, vec![fixed.path().to_path_buf()]);
    assert!(roots.retained.is_empty());
}

#[test]
fn disabled_fixed_drive_scanning_neither_scans_nor_retains_fixed_drives() {
    let fixed = PathBuf::from(r"D:\");
    let roots = roots_for(
        &[],
        false,
        SyncRequest::Refresh,
        vec![fixed],
        Some(&[]),
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

#[test]
fn detached_tracked_volume_retains_only_its_records_as_unavailable() {
    let mut app = super::super::super::app("portable", "Editor");
    app.path = r"F:\Apps\Editor.exe".into();
    app.scan_folder = Some(r"F:\Apps".into());
    app.volume_id = Some("12345678".into());
    let tracked = vec![TrackedVolume {
        folder: r"F:\Apps".into(),
        serial: "12345678".into(),
        label: String::new(),
        filesystem: String::new(),
        mounted_at: None,
    }];
    let mut apps = Vec::new();
    retain_offline_apps(&mut apps, &[app], &tracked, &tracked, &[]);
    assert_eq!(apps.len(), 1);
    assert_eq!(
        apps[0].target_availability.as_deref(),
        Some("target.unverifiable.unmounted_volume")
    );
}

#[test]
fn offline_folders_on_same_volume_remain_distinct_after_one_is_removed() {
    let mut a = super::super::super::app("a", "A");
    a.path = r"F:\A\a.exe".into();
    a.scan_folder = Some(r"F:\A".into());
    a.volume_id = Some("12345678".into());
    let mut b = a.clone();
    b.id = "b".into();
    b.path = r"F:\B\b.exe".into();
    b.scan_folder = Some(r"F:\B".into());
    let tracked = [r"F:\A", r"F:\B"].map(|folder| TrackedVolume {
        folder: folder.into(),
        serial: "12345678".into(),
        label: String::new(),
        filesystem: String::new(),
        mounted_at: None,
    });
    let mut first = Vec::new();
    retain_offline_apps(&mut first, &[a, b], &tracked, &tracked, &[]);
    let mut second = Vec::new();
    retain_offline_apps(&mut second, &first, &tracked[1..], &tracked, &[]);
    assert_eq!(second.len(), 1);
    assert_eq!(second[0].id, "b");
}
