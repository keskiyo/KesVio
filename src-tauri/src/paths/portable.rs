use std::fs;
use std::path::{Path, PathBuf};

const ROOT_DIRECTORY: &str = "AppNookData";
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
    if root.is_dir() {
        return Some(root);
    }
    (create_missing && accepts_writes(&root)).then_some(root)
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

        let root = resolve_root(Some(&dir.path().join("AppNook.exe")), true).unwrap();

        assert_eq!(root, dir.path().join(ROOT_DIRECTORY));
        assert!(root.is_dir());
        assert!(!root.join(PROBE_FILE).exists());
    }

    #[test]
    fn a_root_that_cannot_be_created_is_declined() {
        let dir = tempfile::tempdir().unwrap();
        let occupied = dir.path().join("AppNookData");
        fs::write(&occupied, []).unwrap();

        assert_eq!(
            resolve_root(Some(&dir.path().join("AppNook.exe")), true),
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
    fn an_existing_root_is_adopted_without_probing_it_again() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("AppNook.exe");
        let root = resolve_root(Some(&executable), true).unwrap();
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
    fn a_build_that_may_not_create_a_root_leaves_the_directory_alone() {
        let dir = tempfile::tempdir().unwrap();

        assert_eq!(
            resolve_root(Some(&dir.path().join("AppNook.exe")), false),
            None
        );
        assert!(!dir.path().join(ROOT_DIRECTORY).exists());
    }

    #[test]
    #[cfg(debug_assertions)]
    fn a_development_build_never_plants_a_root_in_its_build_tree() {
        let dir = tempfile::tempdir().unwrap();

        assert_eq!(writable_root(Some(&dir.path().join("AppNook.exe"))), None);
        assert!(!dir.path().join(ROOT_DIRECTORY).exists());
    }

    #[test]
    fn an_existing_root_is_reported_without_creating_one() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("AppNook.exe");

        assert_eq!(existing_root(Some(&executable)), None);
        assert!(!dir.path().join(ROOT_DIRECTORY).exists());

        let created = resolve_root(Some(&executable), true).unwrap();

        assert_eq!(existing_root(Some(&executable)), Some(created));
    }
}
