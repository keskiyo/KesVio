use super::*;

#[test]
fn enumerates_the_apps_folder_without_an_interpreter() {
    let never = || false;

    let Some(entries) = start_apps(&never, &|_| {}) else {
        return;
    };

    assert!(entries.len() <= MAX_ENTRIES + BATCH);
    for entry in &entries {
        assert!(!entry.name.is_empty());
        assert!(!entry.app_id.is_empty());
        assert_eq!(entry.name.trim(), entry.name);
        assert!(entry.target.as_deref() != Some(""));
    }
}

#[test]
fn a_packaged_entry_carries_the_full_name_its_uninstall_needs() {
    let never = || false;

    let Some(entries) = start_apps(&never, &|_| {}) else {
        return;
    };

    for package in entries.iter().filter_map(|entry| entry.package.as_ref()) {
        assert!(package.full_name.contains('_'));
        assert!(package.install_location.as_deref() != Some(""));
    }
}

#[test]
fn a_cancelled_scan_stops_before_the_first_batch() {
    let cancelled = || true;
    let steps = std::cell::Cell::new(0);

    let entries = start_apps(&cancelled, &|_| steps.set(steps.get() + 1));

    assert_eq!(entries, Some(Vec::new()));
    assert_eq!(steps.get(), 0);
}
