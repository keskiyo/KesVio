use crate::catalog::scan_settings::ScanSettings;
use crate::catalog::sync::SyncRequest;
use crate::catalog::AppInfo;
use std::path::{Component, Path, PathBuf, Prefix};

#[derive(Debug, PartialEq, Eq)]
pub(super) struct PortableRoots {
    pub(super) scanned: Vec<PathBuf>,
    pub(super) retained: Vec<PathBuf>,
}

pub(super) fn roots_for(
    settings: &ScanSettings,
    request: SyncRequest,
    fixed_roots: Vec<PathBuf>,
    previous_snapshot: Option<&[AppInfo]>,
    is_directory: impl Fn(&Path) -> bool,
) -> PortableRoots {
    let previous_apps = previous_snapshot.unwrap_or_default();
    let mut scanned = Vec::new();
    let mut retained = Vec::new();
    let mut unmounted = Vec::new();
    for folder in &settings.included_paths {
        let path = PathBuf::from(folder);
        if is_directory(&path) {
            scanned.push(path);
        } else if let Some(root) = drive_root(folder).filter(|root| !is_directory(root)) {
            unmounted.push(root);
        } else {
            retained.push(path);
        }
    }
    if settings.auto_scan_fixed_drives {
        let mut previous_roots = previous_apps
            .iter()
            .filter_map(|app| drive_root(&app.path))
            .collect();
        minimize_roots(&mut previous_roots);
        retained.extend(previous_roots.into_iter().filter(|root| {
            !fixed_roots.iter().any(|fixed| same_root(fixed, root))
                && !unmounted.iter().any(|gone| same_root(gone, root))
                && !is_directory(root)
        }));
        if walks_fixed_drives(request, previous_snapshot.is_some()) {
            scanned.extend(fixed_roots);
        } else {
            retained.extend(fixed_roots);
        }
    }
    minimize_roots(&mut scanned);
    minimize_roots(&mut retained);
    PortableRoots { scanned, retained }
}

pub(super) fn scan_folder_of(path: &str, included_paths: &[String]) -> Option<String> {
    let path = path.trim().to_lowercase();
    included_paths
        .iter()
        .filter(|folder| crate::catalog::path_is_within(&path, &folder.trim().to_lowercase()))
        .max_by_key(|folder| folder.trim().len())
        .map(|folder| folder.trim().to_owned())
}

pub(super) fn stamp_scan_folders(apps: &mut [AppInfo], included_paths: &[String]) {
    for app in apps {
        app.scan_folder = scan_folder_of(&app.path, included_paths);
    }
}

fn walks_fixed_drives(request: SyncRequest, has_previous_snapshot: bool) -> bool {
    match request {
        SyncRequest::Force => true,
        SyncRequest::Watch(_) => false,
        SyncRequest::Startup | SyncRequest::Refresh => !has_previous_snapshot,
    }
}

fn same_root(left: &Path, right: &Path) -> bool {
    left.as_os_str().eq_ignore_ascii_case(right.as_os_str())
}

fn drive_root(path: &str) -> Option<PathBuf> {
    let path = Path::new(path);
    if !path.is_absolute() {
        return None;
    }
    let Component::Prefix(prefix) = path.components().next()? else {
        return None;
    };
    matches!(prefix.kind(), Prefix::Disk(_) | Prefix::VerbatimDisk(_))
        .then(|| path.ancestors().last().map(Path::to_path_buf))
        .flatten()
}

fn minimize_roots(roots: &mut Vec<PathBuf>) {
    roots.sort_by_cached_key(|path| {
        (
            path.components().count(),
            path.to_string_lossy().to_lowercase(),
        )
    });
    let mut minimized: Vec<PathBuf> = Vec::new();
    for root in roots.drain(..) {
        let key = root.to_string_lossy().to_lowercase();
        if minimized.iter().any(|parent| {
            crate::catalog::path_is_within(&key, &parent.to_string_lossy().to_lowercase())
        }) {
            continue;
        }
        minimized.push(root);
    }
    *roots = minimized;
}

#[cfg(test)]
mod tests;
