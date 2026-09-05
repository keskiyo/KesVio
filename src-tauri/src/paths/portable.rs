use std::fs;
use std::path::{Path, PathBuf};

const ROOT_DIRECTORY: &str = "KesVioData";
const PROBE_FILE: &str = "write-probe.tmp";
const CREATE_MISSING_ROOT: bool = !cfg!(debug_assertions);

pub(super) fn writable_root(executable: Option<&Path>) -> Option<PathBuf> {
    resolve_root(executable, CREATE_MISSING_ROOT)
}

pub(super) fn existing_root(executable: Option<&Path>) -> Option<PathBuf> {
    let root = executable?.parent()?.join(ROOT_DIRECTORY);
    root.is_dir().then_some(root)
}

fn resolve_root(executable: Option<&Path>, create_missing: bool) -> Option<PathBuf> {
    let root = executable?.parent()?.join(ROOT_DIRECTORY);
    if already_written(&root) {
        return Some(root);
    }
    (create_missing && accepts_writes(&root)).then_some(root)
}

fn already_written(root: &Path) -> bool {
    root.join(super::DATA_DIRECTORY).is_dir() || root.join(super::LOG_DIRECTORY).is_dir()
}

fn accepts_writes(root: &Path) -> bool {
    if fs::create_dir_all(root).is_err() {
        return false;
    }
    let probe = root.join(PROBE_FILE);
    let accepted = fs::write(&probe, []).is_ok();
    let _ = fs::remove_file(&probe);
    accepted
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_writable_executable_directory_hosts_the_data_root() {
        let dir = tempfile::tempdir().unwrap();

        let root = resolve_root(Some(&dir.path().join("KesVio.exe")), true).unwrap();

        assert_eq!(root, dir.path().join(ROOT_DIRECTORY));
        assert!(root.is_dir());
        assert!(!root.join(PROBE_FILE).exists());
    }

    #[test]
    fn a_root_that_cannot_be_created_is_declined() {
        let dir = tempfile::tempdir().unwrap();
        let occupied = dir.path().join("KesVioData");
        fs::write(&occupied, []).unwrap();

        assert_eq!(
            resolve_root(Some(&dir.path().join("KesVio.exe")), true),
            None
        );
        assert!(occupied.is_file());
    }

    #[test]
    fn an_unknown_executable_has_no_root() {
        assert_eq!(writable_root(None), None);
        assert_eq!(writable_root(Some(Path::new(""))), None);
    }

    #[test]
    fn a_root_this_application_has_written_is_adopted_without_probing_it_again() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("KesVio.exe");
        let root = resolve_root(Some(&executable), true).unwrap();
        fs::create_dir_all(root.join(super::super::DATA_DIRECTORY)).unwrap();
        let probe = root.join(PROBE_FILE);
        fs::write(&probe, []).unwrap();

        assert_eq!(resolve_root(Some(&executable), true), Some(root.clone()));
        assert_eq!(resolve_root(Some(&executable), false), Some(root));

        assert!(
            probe.is_file(),
            "a second run must not touch the probe file it no longer needs"
        );
    }

    #[test]
    fn a_root_someone_else_created_is_probed_before_it_is_trusted() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("KesVio.exe");
        let root = dir.path().join(ROOT_DIRECTORY);
        fs::create_dir_all(&root).unwrap();

        assert_eq!(resolve_root(Some(&executable), true), Some(root.clone()));
        assert_eq!(resolve_root(Some(&executable), false), None);
        assert!(!root.join(PROBE_FILE).exists());
    }

    #[test]
    fn a_root_that_cannot_be_written_falls_back_instead_of_being_adopted() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("KesVio.exe");
        let root = dir.path().join(ROOT_DIRECTORY);
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(root.join(PROBE_FILE)).unwrap();

        assert_eq!(resolve_root(Some(&executable), true), None);
        assert!(root.is_dir());
    }

    #[test]
    fn a_build_that_may_not_create_a_root_leaves_the_directory_alone() {
        let dir = tempfile::tempdir().unwrap();

        assert_eq!(
            resolve_root(Some(&dir.path().join("KesVio.exe")), false),
            None
        );
        assert!(!dir.path().join(ROOT_DIRECTORY).exists());
    }

    #[test]
    #[cfg(debug_assertions)]
    fn a_development_build_never_plants_a_root_in_its_build_tree() {
        let dir = tempfile::tempdir().unwrap();

        assert_eq!(writable_root(Some(&dir.path().join("KesVio.exe"))), None);
        assert!(!dir.path().join(ROOT_DIRECTORY).exists());
    }

    #[test]
    fn an_existing_root_is_reported_without_creating_one() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("KesVio.exe");

        assert_eq!(existing_root(Some(&executable)), None);
        assert!(!dir.path().join(ROOT_DIRECTORY).exists());

        let created = resolve_root(Some(&executable), true).unwrap();

        assert_eq!(existing_root(Some(&executable)), Some(created));
    }
}
