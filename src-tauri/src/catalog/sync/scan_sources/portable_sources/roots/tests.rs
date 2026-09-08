use super::*;

fn previous(path: &str) -> Vec<AppInfo> {
    let mut app = crate::app_state::cached_app("Editor", path);
    app.source_kind = crate::catalog::SourceKind::Portable;
    vec![app]
}

#[test]
fn unavailable_explicit_roots_remain_in_scope_in_every_scan_mode() {
    let settings = ScanSettings {
        auto_scan_fixed_drives: false,
        included_paths: vec![r"Q:\Portable".into()],
        ..ScanSettings::default()
    };
    for request in [
        SyncRequest::Startup,
        SyncRequest::Watch,
        SyncRequest::Refresh,
        SyncRequest::Force,
    ] {
        let roots = roots_for(&settings, request, Vec::new(), &[], |_| false);
        assert!(roots.scanned.is_empty());
        assert_eq!(roots.retained, vec![PathBuf::from(r"Q:\Portable")]);
    }
}

#[test]
fn removing_explicit_scope_does_not_retain_an_offline_drive_when_auto_scan_is_disabled() {
    let settings = ScanSettings {
        auto_scan_fixed_drives: false,
        ..ScanSettings::default()
    };
    let roots = roots_for(
        &settings,
        SyncRequest::Startup,
        Vec::new(),
        &previous(r"Q:\Portable\Editor.exe"),
        |_| false,
    );
    assert!(roots.scanned.is_empty());
    assert!(roots.retained.is_empty());
}

#[test]
fn a_reachable_non_fixed_drive_is_not_retained_after_removing_its_explicit_scope() {
    let roots = roots_for(
        &ScanSettings::default(),
        SyncRequest::Startup,
        vec![PathBuf::from(r"C:\")],
        &previous(r"Q:\Portable\Editor.exe"),
        |_| true,
    );
    assert_eq!(roots.retained, vec![PathBuf::from(r"C:\")]);
}

#[test]
fn force_scans_live_drives_and_preserves_offline_records_until_the_drive_returns() {
    let settings = ScanSettings::default();
    let apps = previous(r"Q:\Portable\Editor.exe");
    let offline = roots_for(
        &settings,
        SyncRequest::Force,
        vec![PathBuf::from(r"C:\")],
        &apps,
        |_| false,
    );
    assert_eq!(offline.scanned, vec![PathBuf::from(r"C:\")]);
    assert_eq!(offline.retained, vec![PathBuf::from(r"Q:\")]);
    let online = roots_for(
        &settings,
        SyncRequest::Force,
        vec![PathBuf::from(r"C:\"), PathBuf::from(r"Q:\")],
        &apps,
        |_| true,
    );
    assert_eq!(online.scanned.len(), 2);
    assert!(online.retained.is_empty());
}

#[test]
fn previous_network_and_relative_paths_do_not_create_automatic_drive_scope() {
    for path in [r"\\server\share\Editor.exe", r"Q:Editor.exe", "Editor.exe"] {
        let roots = roots_for(
            &ScanSettings::default(),
            SyncRequest::Startup,
            Vec::new(),
            &previous(path),
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
        &ScanSettings::default(),
        SyncRequest::Startup,
        Vec::new(),
        &apps,
        |_| {
            checks.set(checks.get() + 1);
            false
        },
    );
    assert_eq!(checks.get(), 1);
    assert_eq!(roots.retained.len(), 1);
}
