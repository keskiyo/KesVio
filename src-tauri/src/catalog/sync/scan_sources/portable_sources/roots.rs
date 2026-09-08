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
    previous_apps: &[AppInfo],
    is_directory: impl Fn(&Path) -> bool,
) -> PortableRoots {
    let (mut scanned, mut retained): (Vec<_>, Vec<_>) = settings
        .included_paths
        .iter()
        .map(PathBuf::from)
        .partition(|path| is_directory(path));
    if settings.auto_scan_fixed_drives {
        let mut previous_roots = previous_apps
            .iter()
            .filter_map(|app| drive_root(&app.path))
            .collect();
        minimize_roots(&mut previous_roots);
        retained.extend(previous_roots.into_iter().filter(|root| {
            !fixed_roots
                .iter()
                .any(|fixed| fixed.as_os_str().eq_ignore_ascii_case(root.as_os_str()))
                && !is_directory(root)
        }));
        if request == SyncRequest::Force {
            scanned.extend(fixed_roots);
        } else {
            retained.extend(fixed_roots);
        }
    }
    minimize_roots(&mut scanned);
    minimize_roots(&mut retained);
    PortableRoots { scanned, retained }
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
