use std::fs;
use std::path::Path;

const RETIRED_DOCUMENTS: &[&str] = &["uninstall-history.json", "uninstall-history.json.tmp"];

pub(super) fn remove_retired_documents(directory: &Path) -> usize {
    RETIRED_DOCUMENTS
        .iter()
        .map(|name| directory.join(name))
        .filter(|path| path.is_file() && fs::remove_file(path).is_ok())
        .count()
}

pub(super) fn copy_documents(destination: &Path, previous: &Path) -> usize {
    if destination.exists() || !previous.is_dir() {
        return 0;
    }
    let Ok(entries) = fs::read_dir(previous) else {
        return 0;
    };
    if fs::create_dir_all(destination).is_err() {
        return 0;
    }
    let mut adopted = 0;
    for entry in entries.flatten() {
        if !entry.file_type().is_ok_and(|kind| kind.is_file()) {
            continue;
        }
        if fs::copy(entry.path(), destination.join(entry.file_name())).is_ok() {
            adopted += 1;
        }
    }
    adopted
}

#[cfg(test)]
mod tests {
    use super::*;

    fn previous_folder() -> tempfile::TempDir {
        let previous = tempfile::tempdir().unwrap();
        fs::write(previous.path().join("apps-cache.json"), "{}").unwrap();
        fs::write(previous.path().join("scan-settings.json"), "{}").unwrap();
        fs::create_dir(previous.path().join("icons")).unwrap();
        fs::write(previous.path().join("icons").join("a.png"), []).unwrap();
        previous
    }

    #[test]
    fn documents_move_across_once_and_the_previous_folder_survives() {
        let previous = previous_folder();
        let root = tempfile::tempdir().unwrap();
        let destination = root.path().join("data");

        assert_eq!(copy_documents(&destination, previous.path()), 2);

        assert_eq!(
            fs::read_to_string(destination.join("apps-cache.json")).unwrap(),
            "{}"
        );
        assert!(destination.join("scan-settings.json").is_file());
        assert!(!destination.join("icons").exists());
        assert!(previous.path().join("apps-cache.json").is_file());
    }

    #[test]
    fn an_existing_destination_is_never_refilled() {
        let previous = previous_folder();
        let root = tempfile::tempdir().unwrap();
        let destination = root.path().join("data");
        fs::create_dir_all(&destination).unwrap();

        assert_eq!(copy_documents(&destination, previous.path()), 0);
        assert!(!destination.join("apps-cache.json").exists());
    }

    // The uninstall feature is gone, and its history recorded which programs the user removed from
    // their PC. Leaving that file behind would keep the record the feature's removal was meant to
    // end, so the folder is swept once per start.
    #[test]
    fn a_retired_history_is_removed_and_nothing_else_is_touched() {
        let directory = tempfile::tempdir().unwrap();
        fs::write(directory.path().join("uninstall-history.json"), "[]").unwrap();
        fs::write(directory.path().join("uninstall-history.json.tmp"), "[]").unwrap();
        fs::write(directory.path().join("apps-cache.json"), "{}").unwrap();

        assert_eq!(remove_retired_documents(directory.path()), 2);

        assert!(!directory.path().join("uninstall-history.json").exists());
        assert!(!directory.path().join("uninstall-history.json.tmp").exists());
        assert!(directory.path().join("apps-cache.json").is_file());
    }

    #[test]
    fn removing_a_retired_history_twice_is_not_an_error() {
        let directory = tempfile::tempdir().unwrap();

        assert_eq!(remove_retired_documents(directory.path()), 0);
        assert_eq!(remove_retired_documents(directory.path()), 0);
    }

    #[test]
    fn a_missing_previous_folder_is_not_a_failure() {
        let root = tempfile::tempdir().unwrap();
        let destination = root.path().join("data");

        assert_eq!(copy_documents(&destination, &root.path().join("absent")), 0);
        assert!(!destination.exists());
    }
}
