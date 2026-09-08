use crate::platform::windows::com::CoTaskString;
use std::path::PathBuf;
use windows::core::GUID;
use windows::Win32::UI::Shell::{
    FOLDERID_Desktop, FOLDERID_Downloads, SHGetKnownFolderPath, KF_FLAG_DEFAULT,
};

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub(crate) struct UserFolders {
    pub downloads: Option<PathBuf>,
    pub desktop: Option<PathBuf>,
    pub temp: Option<PathBuf>,
}

pub(crate) fn user_folders() -> UserFolders {
    UserFolders {
        downloads: known_folder(&FOLDERID_Downloads),
        desktop: known_folder(&FOLDERID_Desktop),
        temp: std::env::var_os("TEMP").map(PathBuf::from),
    }
}

fn known_folder(id: &GUID) -> Option<PathBuf> {
    let _operation = crate::diagnostics::Operation::start("known folder resolution");
    log::info!("Known folder requested: id={id:?}");
    // SAFETY: `id` points at a `FOLDERID_*` constant that lives for the whole program, so the
    // pointer is valid for the call. `KF_FLAG_DEFAULT` requests the current path without creating
    // anything, and passing no access token means "the calling user", which is the process owner.
    // On success the API allocates a null-terminated UTF-16 string that the caller owns;
    // `CoTaskString::own` takes that ownership immediately, so it is released exactly once on every
    // path out of this function. On failure nothing is allocated and there is nothing to release.
    let path = unsafe { SHGetKnownFolderPath(id, KF_FLAG_DEFAULT, None) };
    let path = match path {
        Ok(path) => path,
        Err(error) => {
            log::warn!(
                "Known folder unavailable: id={id:?} hresult={:?}",
                error.code()
            );
            return None;
        }
    };
    let resolved = CoTaskString::own(path).to_trimmed().map(PathBuf::from);
    let network = resolved.as_ref().is_some_and(|path| {
        let value = path.to_string_lossy();
        value.starts_with(r"\\") || value.starts_with("//")
    });
    log::info!(
        "Known folder resolved: id={id:?} present={} network={network}",
        resolved.is_some()
    );
    resolved
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_user_folders_without_panicking() {
        let folders = user_folders();

        for folder in [folders.downloads, folders.desktop, folders.temp]
            .into_iter()
            .flatten()
        {
            assert!(folder.is_absolute(), "{}", folder.display());
            assert!(!folder.as_os_str().is_empty());
        }
    }
}
