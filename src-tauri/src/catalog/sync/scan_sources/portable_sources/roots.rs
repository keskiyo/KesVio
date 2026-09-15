use crate::catalog::sync::SyncRequest;
use crate::catalog::volumes::ResolvedFolder;
use crate::catalog::AppInfo;
use std::path::{Component, Path, PathBuf, Prefix};

#[derive(Debug, PartialEq, Eq)]
pub(super) struct PortableRoots {
    pub(super) scanned: Vec<PathBuf>,
    pub(super) retained: Vec<PathBuf>,
    pub(super) unreachable: usize,
}

pub(super) fn roots_for(
    folders: &[ResolvedFolder],
    auto_scan_fixed_drives: bool,
    request: SyncRequest,
    fixed_roots: Vec<PathBuf>,
    previous_snapshot: Option<&[AppInfo]>,
    is_directory: impl Fn(&Path) -> bool,
) -> PortableRoots {
    let previous_apps = previous_snapshot.unwrap_or_default();
    let mut scanned = Vec::new();
    let mut retained = Vec::new();
    let mut unmounted = Vec::new();
    let mut unreachable = 0;
    for folder in folders {
        let path = PathBuf::from(&folder.path);
        if is_directory(&path) {
            scanned.push(path);
            if !folder.configured.eq_ignore_ascii_case(&folder.path) {
                unmounted.extend(drive_root(&folder.configured).filter(|root| !is_directory(root)));
            }
        } else if let Some(root) = drive_root(&folder.path).filter(|root| !is_directory(root)) {
            unmounted.push(root);
        } else {
            unreachable += 1;
            retained.push(path);
        }
    }
    if auto_scan_fixed_drives {
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
    PortableRoots {
        scanned,
        retained,
        unreachable,
    }
}

pub(super) fn scan_folder_of<'a>(
    path: &str,
    folders: &'a [ResolvedFolder],
) -> Option<&'a ResolvedFolder> {
    let path = path.trim().to_lowercase();
    folders
        .iter()
        .filter(|folder| crate::catalog::path_is_within(&path, &folder.path.trim().to_lowercase()))
        .max_by_key(|folder| folder.path.trim().len())
}

pub(super) fn stamp_scan_folders(apps: &mut [AppInfo], folders: &[ResolvedFolder]) {
    for app in apps {
        let folder = scan_folder_of(&app.path, folders);
        app.scan_folder = folder.map(|folder| folder.path.trim().to_owned());
        app.volume_id = folder.and_then(|folder| folder.volume.clone());
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
