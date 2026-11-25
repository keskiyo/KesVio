use super::{cache_key, icons_dir, CACHE_KEY_LENGTH, MAX_ICON_BYTES};
use std::fs;
use std::path::Path;

pub(crate) fn read_offline_icon(app_data_dir: &Path, app_id: &str) -> Option<Vec<u8>> {
    let prefix = format!("{}-", cache_key(app_id));
    let mut candidate = None;
    for (index, entry) in fs::read_dir(icons_dir(app_data_dir)).ok()?.enumerate() {
        if index >= 4096 {
            return None;
        }
        let entry = entry.ok()?;
        let name = entry.file_name();
        let name = name.to_str()?;
        let Some(fingerprint) = name
            .strip_prefix(&prefix)
            .and_then(|name| name.strip_suffix(".png"))
        else {
            continue;
        };
        if fingerprint.len() != CACHE_KEY_LENGTH
            || !fingerprint.bytes().all(|byte| byte.is_ascii_hexdigit())
        {
            continue;
        }
        if candidate.is_some() {
            return None;
        }
        candidate = Some(entry.path());
    }
    let path = candidate?;
    let metadata = fs::metadata(&path).ok()?;
    if !metadata.is_file() || metadata.len() > MAX_ICON_BYTES {
        return None;
    }
    fs::read(path).ok()
}
