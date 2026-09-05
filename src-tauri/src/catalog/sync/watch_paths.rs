use crate::catalog::scan_settings;
use std::env;
use std::path::PathBuf;

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

pub(in crate::catalog) fn watcher_paths(settings: &scan_settings::ScanSettings) -> Vec<PathBuf> {
    let mut paths = vec![PathBuf::from(
        r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs",
    )];
    if let Some(appdata) = env::var_os("APPDATA") {
        paths.push(PathBuf::from(appdata).join(r"Microsoft\Windows\Start Menu\Programs"));
    }
    paths.extend(settings.included_paths.iter().map(PathBuf::from));
    paths.retain(|path| path.is_dir());
    paths.sort_by_cached_key(|path| path.to_string_lossy().to_lowercase());
    paths.dedup_by(|left, right| {
        left.to_string_lossy()
            .eq_ignore_ascii_case(&right.to_string_lossy())
    });
    paths
}
