use super::*;

fn previous(path: &str) -> Vec<AppInfo> {
    let mut app = crate::app_state::cached_app("Editor", path);
    app.source_kind = crate::catalog::SourceKind::Portable;
    vec![app]
}

fn folders(paths: &[&str]) -> Vec<ResolvedFolder> {
    paths
        .iter()
        .map(|path| ResolvedFolder {
            configured: (*path).to_owned(),
            path: (*path).to_owned(),
            volume: None,
        })
        .collect()
}

fn followed(configured: &str, path: &str, volume: &str) -> ResolvedFolder {
    ResolvedFolder {
        configured: configured.to_owned(),
        path: path.to_owned(),
        volume: Some(volume.to_owned()),
    }
}

const EVERY_REQUEST: [SyncRequest; 4] = [
    SyncRequest::Startup,
    SyncRequest::Watch(crate::catalog::sync::WatchScope::PORTABLE),
    SyncRequest::Refresh,
    SyncRequest::Force,
];

#[test]
fn a_missing_folder_on_a_mounted_drive_remains_in_scope_in_every_scan_mode() {
    for request in EVERY_REQUEST {
        let roots = roots_for(
            &folders(&[r"Q:\Portable"]),
            false,
            request,
            Vec::new(),
            Some(&[]),
            |path| path == Path::new(r"Q:\"),
        );
        assert!(roots.scanned.is_empty());
        assert_eq!(roots.retained, vec![PathBuf::from(r"Q:\Portable")]);
    }
}

// An unreachable folder on a mounted drive or share is what the bounded retry follows up on;
// an unmounted drive is not, because its return is announced by the volume watcher instead.
#[test]
fn only_a_retained_folder_counts_as_unreachable() {
    let roots = roots_for(
        &folders(&[
            r"Q:\Portable",
            r"\\server\share\apps",
            r"F:\Apps",
            r"C:\Tools",
        ]),
        false,
        SyncRequest::Refresh,
        Vec::new(),
        Some(&[]),
        |path| {
            path == Path::new(r"Q:\") || path == Path::new(r"C:\") || path == Path::new(r"C:\Tools")
        },
    );

    assert_eq!(roots.unreachable, 2);
    assert_eq!(roots.scanned, vec![PathBuf::from(r"C:\Tools")]);
    assert_eq!(
        roots.retained,
        vec![
            PathBuf::from(r"\\server\share\apps"),
            PathBuf::from(r"Q:\Portable")
        ]
    );
}

#[test]
fn a_scan_folder_on_an_unmounted_drive_is_dropped_in_every_scan_mode() {
    for request in EVERY_REQUEST {
        let roots = roots_for(
            &folders(&[r"F:\", r"F:\Apps"]),
            false,
            request,
            Vec::new(),
            Some(&[]),
            |_| false,
        );
        assert!(roots.scanned.is_empty(), "{request:?}");
        assert!(roots.retained.is_empty(), "{request:?}");
    }
}

#[test]
fn an_unmounted_scan_drive_is_not_retained_through_its_previous_records() {
    let mut apps = previous(r"F:\Tools\Editor.exe");
    apps.extend(previous(r"Q:\Portable\Viewer.exe"));
    let roots = roots_for(
        &folders(&[r"f:\"]),
        true,
        SyncRequest::Startup,
        vec![PathBuf::from(r"C:\")],
        Some(&apps),
        |path| path == Path::new(r"C:\"),
    );
    assert!(roots.scanned.is_empty());
    assert_eq!(
        roots.retained,
        vec![PathBuf::from(r"C:\"), PathBuf::from(r"Q:\")]
    );
}

#[test]
fn a_returned_scan_drive_is_walked_again() {
    let roots = roots_for(
        &folders(&[r"F:\"]),
        true,
        SyncRequest::Refresh,
        vec![PathBuf::from(r"C:\")],
        Some(&[]),
        |_| true,
    );
    assert_eq!(roots.scanned, vec![PathBuf::from(r"F:\")]);
    assert_eq!(roots.retained, vec![PathBuf::from(r"C:\")]);
}

#[test]
fn a_folder_followed_to_another_letter_is_walked_there_and_its_old_letter_is_dropped() {
    let apps = previous(r"F:\Tools\Editor.exe");
    let roots = roots_for(
        &[followed(r"F:\", r"G:\", "1a2b3c4d")],
        true,
        SyncRequest::Refresh,
        vec![PathBuf::from(r"C:\")],
        Some(&apps),
        |path| path == Path::new(r"G:\") || path == Path::new(r"C:\"),
    );
    assert_eq!(roots.scanned, vec![PathBuf::from(r"G:\")]);
    assert_eq!(roots.retained, vec![PathBuf::from(r"C:\")]);
}

#[test]
fn removing_explicit_scope_does_not_retain_an_offline_drive_when_auto_scan_is_disabled() {
    let roots = roots_for(
        &[],
        false,
        SyncRequest::Startup,
        Vec::new(),
        Some(&previous(r"Q:\Portable\Editor.exe")),
        |_| false,
    );
    assert!(roots.scanned.is_empty());
    assert!(roots.retained.is_empty());
}

#[test]
fn a_reachable_non_fixed_drive_is_not_retained_after_removing_its_explicit_scope() {
    let roots = roots_for(
        &[],
        true,
        SyncRequest::Startup,
        vec![PathBuf::from(r"C:\")],
        Some(&previous(r"Q:\Portable\Editor.exe")),
        |_| true,
    );
    assert_eq!(roots.retained, vec![PathBuf::from(r"C:\")]);
}

#[test]
fn force_scans_live_drives_and_preserves_offline_records_until_the_drive_returns() {
    let apps = previous(r"Q:\Portable\Editor.exe");
    let offline = roots_for(
        &[],
        true,
        SyncRequest::Force,
        vec![PathBuf::from(r"C:\")],
        Some(&apps),
        |_| false,
    );
    assert_eq!(offline.scanned, vec![PathBuf::from(r"C:\")]);
    assert_eq!(offline.retained, vec![PathBuf::from(r"Q:\")]);
    let online = roots_for(
        &[],
        true,
        SyncRequest::Force,
        vec![PathBuf::from(r"C:\"), PathBuf::from(r"Q:\")],
        Some(&apps),
        |_| true,
    );
    assert_eq!(online.scanned.len(), 2);
    assert!(online.retained.is_empty());
}

#[test]
fn a_catalog_without_a_portable_snapshot_walks_the_fixed_drives_on_its_first_routine_scan() {
    let fixed = vec![PathBuf::from(r"C:\"), PathBuf::from(r"D:\")];
    for request in [SyncRequest::Startup, SyncRequest::Refresh] {
        let roots = roots_for(&[], true, request, fixed.clone(), None, |_| true);
        assert_eq!(
            roots.scanned, fixed,
            "{request:?} must walk the drives once"
        );
        assert!(roots.retained.is_empty());
    }
}

#[test]
fn an_existing_portable_snapshot_keeps_routine_scans_off_the_fixed_drives() {
    let fixed = vec![PathBuf::from(r"C:\")];
    for request in [SyncRequest::Startup, SyncRequest::Refresh] {
        let roots = roots_for(&[], true, request, fixed.clone(), Some(&[]), |_| true);
        assert!(
            roots.scanned.is_empty(),
            "{request:?} must stay incremental"
        );
        assert_eq!(roots.retained, fixed);
    }
}

#[test]
fn a_watch_event_never_walks_the_fixed_drives_even_without_a_snapshot() {
    let roots = roots_for(
        &[],
        true,
        SyncRequest::Watch(crate::catalog::sync::WatchScope::PORTABLE),
        vec![PathBuf::from(r"C:\")],
        None,
        |_| true,
    );
    assert!(roots.scanned.is_empty());
    assert_eq!(roots.retained, vec![PathBuf::from(r"C:\")]);
}

#[test]
fn previous_network_and_relative_paths_do_not_create_automatic_drive_scope() {
    for path in [r"\\server\share\Editor.exe", r"Q:Editor.exe", "Editor.exe"] {
        let roots = roots_for(
            &[],
            true,
            SyncRequest::Startup,
            Vec::new(),
            Some(&previous(path)),
            |_| false,
        );
        assert!(roots.scanned.is_empty());
        assert!(roots.retained.is_empty());
    }
}

#[test]
fn cached_drive_availability_is_checked_once_per_drive_not_per_application() {
    let checks = std::cell::Cell::new(0);
    let mut apps = previous(r"Q:\Portable\Editor.exe");
    apps.extend(previous(r"q:\Other\Viewer.exe"));
    let roots = roots_for(
        &[],
        true,
        SyncRequest::Startup,
        Vec::new(),
        Some(&apps),
        |_| {
            checks.set(checks.get() + 1);
            false
        },
    );
    assert_eq!(checks.get(), 1);
    assert_eq!(roots.retained.len(), 1);
}

#[test]
fn a_record_names_the_deepest_added_folder_that_contains_it() {
    let included = folders(&[r"F:\", r"D:\", r"D:\Apps"]);

    assert_eq!(
        scan_folder_of(r"F:\Tools\rufus.exe", &included).map(|folder| folder.path.as_str()),
        Some(r"F:\")
    );
    assert_eq!(
        scan_folder_of(r"D:\Apps\HxD\HxD.exe", &included).map(|folder| folder.path.as_str()),
        Some(r"D:\Apps")
    );
    assert_eq!(
        scan_folder_of(r"D:\Games\Brotato\Brotato.exe", &included)
            .map(|folder| folder.path.as_str()),
        Some(r"D:\")
    );
    assert!(scan_folder_of(r"E:\Portable\aida64.exe", &included).is_none());
}

#[test]
fn an_added_folder_matches_regardless_of_case_and_trailing_separator() {
    assert_eq!(
        scan_folder_of(r"f:\tools\rufus.exe", &folders(&[r"F:\ "]))
            .map(|folder| folder.path.trim()),
        Some(r"F:\")
    );
    assert_eq!(
        scan_folder_of(r"D:\Apps\HxD\HxD.exe", &folders(&[r"d:\apps\"]))
            .map(|folder| folder.path.as_str()),
        Some(r"d:\apps\")
    );
    assert!(scan_folder_of(r"D:\Applications\x.exe", &folders(&[r"D:\Apps"])).is_none());
}

#[test]
fn stamping_covers_scanned_and_retained_records_alike() {
    let mut apps = previous(r"F:\Tools\Editor.exe");
    apps.extend(previous(r"C:\Portable\Viewer.exe"));

    stamp_scan_folders(&mut apps, &folders(&[r"F:\"]));

    assert_eq!(apps[0].scan_folder.as_deref(), Some(r"F:\"));
    assert_eq!(apps[0].volume_id, None);
    assert_eq!(apps[1].scan_folder, None);
    assert_eq!(apps[1].volume_id, None);
}

#[test]
fn a_record_under_a_followed_folder_is_stamped_with_the_place_it_is_and_its_volume() {
    let mut apps = previous(r"G:\Tools\Editor.exe");

    stamp_scan_folders(&mut apps, &[followed(r"F:\", r"G:\", "1a2b3c4d")]);

    assert_eq!(apps[0].scan_folder.as_deref(), Some(r"G:\"));
    assert_eq!(apps[0].volume_id.as_deref(), Some("1a2b3c4d"));
}
