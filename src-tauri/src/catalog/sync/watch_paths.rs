use crate::catalog::scan_settings;
use crate::catalog::sync::WatchScope;
use std::env;
use std::path::PathBuf;

#[derive(Clone, Debug, Eq, PartialEq)]
pub(in crate::catalog) struct WatchRoot {
    pub path: PathBuf,
    pub scope: WatchScope,
}

impl WatchRoot {
    fn new(path: PathBuf, scope: WatchScope) -> Self {
        Self { path, scope }
    }
}

pub(in crate::catalog) fn default_portable_exclusions() -> Vec<PathBuf> {
    [
        "WINDIR",
        "ProgramFiles",
        "ProgramFiles(x86)",
        "ProgramData",
        "APPDATA",
        "LOCALAPPDATA",
    ]
    .into_iter()
    .filter_map(env::var_os)
    .map(PathBuf::from)
    .collect()
}

pub(in crate::catalog) fn watcher_paths(settings: &scan_settings::ScanSettings) -> Vec<WatchRoot> {
    let mut roots = vec![WatchRoot::new(
        PathBuf::from(r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs"),
        WatchScope::START_MENU,
    )];
    if let Some(appdata) = env::var_os("APPDATA") {
        roots.push(WatchRoot::new(
            PathBuf::from(appdata).join(r"Microsoft\Windows\Start Menu\Programs"),
            WatchScope::START_MENU,
        ));
    }
    roots.extend(
        settings
            .included_paths
            .iter()
            .map(PathBuf::from)
            .map(|path| WatchRoot::new(path, WatchScope::PORTABLE)),
    );
    roots.retain(|root| root.path.is_dir());
    normalize_roots(roots)
}

fn normalize_roots(mut roots: Vec<WatchRoot>) -> Vec<WatchRoot> {
    roots.sort_by_cached_key(|root| root.path.to_string_lossy().to_lowercase());
    let mut normalized: Vec<WatchRoot> = Vec::new();
    for root in roots {
        if let Some(previous) = normalized.last_mut().filter(|previous| {
            previous
                .path
                .to_string_lossy()
                .eq_ignore_ascii_case(&root.path.to_string_lossy())
        }) {
            previous.scope = previous.scope.union(root.scope);
        } else {
            normalized.push(root);
        }
    }
    normalized
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog::sync::WatchScope;

    #[test]
    fn identical_roots_union_their_scopes() {
        let roots = normalize_roots(vec![
            WatchRoot::new(PathBuf::from(r"C:\Menu"), WatchScope::START_MENU),
            WatchRoot::new(PathBuf::from(r"c:\menu"), WatchScope::PORTABLE),
        ]);

        assert_eq!(roots.len(), 1);
        assert_eq!(
            roots[0].scope,
            WatchScope::START_MENU.union(WatchScope::PORTABLE)
        );
    }
}
