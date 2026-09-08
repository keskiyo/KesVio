mod adopt;
mod portable;

use std::path::PathBuf;
use tauri::{AppHandle, Manager, Runtime};

const DATA_DIRECTORY: &str = "data";
const LOG_DIRECTORY: &str = "logs";
const BUNDLE_IDENTIFIER: &str = "keskiyo.kesvio";

#[derive(Clone, Debug, Default)]
pub(crate) struct Locations {
    root: Option<PathBuf>,
}

impl Locations {
    pub(crate) fn beside_executable() -> Self {
        Self {
            root: portable::writable_root(std::env::current_exe().ok().as_deref()),
        }
    }

    pub(crate) fn data(&self) -> Option<PathBuf> {
        self.root.as_ref().map(|root| root.join(DATA_DIRECTORY))
    }

    pub(crate) fn logs(&self) -> Option<PathBuf> {
        self.root.as_ref().map(|root| root.join(LOG_DIRECTORY))
    }
}

pub(crate) fn data_dir<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<PathBuf> {
    match beside_executable(app, Locations::data) {
        Some(directory) => Ok(directory),
        None => app.path().app_data_dir(),
    }
}

pub(crate) fn log_dir<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<PathBuf> {
    match beside_executable(app, Locations::logs) {
        Some(directory) => Ok(directory),
        None => app.path().app_log_dir(),
    }
}

pub(crate) fn report_dir() -> Option<PathBuf> {
    portable::existing_root(std::env::current_exe().ok().as_deref())
        .map(|root| root.join(DATA_DIRECTORY))
        .or_else(|| {
            std::env::var_os("LOCALAPPDATA").map(|base| PathBuf::from(base).join(BUNDLE_IDENTIFIER))
        })
}

pub(crate) fn adopt_previous_documents<R: Runtime>(app: &AppHandle<R>) {
    let Some(destination) = beside_executable(app, Locations::data) else {
        return;
    };
    let Ok(previous) = app.path().app_data_dir() else {
        return;
    };
    let adopted = adopt::copy_documents(&destination, &previous);
    if adopted > 0 {
        log::info!("Adopted {adopted} stored files from the previous data folder");
    }
}

pub(crate) fn remove_retired_documents<R: Runtime>(app: &AppHandle<R>) {
    let Ok(directory) = data_dir(app) else {
        return;
    };
    let removed = adopt::remove_retired_documents(&directory);
    if removed > 0 {
        log::info!("Removed {removed} stored files no longer written by this version");
    }
}

fn beside_executable<R: Runtime>(
    app: &AppHandle<R>,
    directory: fn(&Locations) -> Option<PathBuf>,
) -> Option<PathBuf> {
    managed_directory(app.try_state::<Locations>().as_deref(), directory)
}

fn managed_directory(
    locations: Option<&Locations>,
    directory: fn(&Locations) -> Option<PathBuf>,
) -> Option<PathBuf> {
    directory(locations?)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn resolved() -> Locations {
        Locations {
            root: Some(PathBuf::from(r"C:\Apps\KesVio\KesVioData")),
        }
    }

    #[test]
    fn a_resolved_root_carries_separate_data_and_log_folders() {
        let locations = resolved();

        assert_eq!(
            locations.data(),
            Some(PathBuf::from(r"C:\Apps\KesVio\KesVioData\data"))
        );
        assert_eq!(
            locations.logs(),
            Some(PathBuf::from(r"C:\Apps\KesVio\KesVioData\logs"))
        );
    }

    #[test]
    fn without_a_root_every_folder_falls_back_to_the_platform_location() {
        let locations = Locations::default();

        assert_eq!(locations.data(), None);
        assert_eq!(locations.logs(), None);
    }

    #[test]
    fn a_resolved_root_answers_both_directory_requests() {
        let locations = resolved();

        assert_eq!(
            managed_directory(Some(&locations), Locations::data),
            Some(PathBuf::from(r"C:\Apps\KesVio\KesVioData\data"))
        );
        assert_eq!(
            managed_directory(Some(&locations), Locations::logs),
            Some(PathBuf::from(r"C:\Apps\KesVio\KesVioData\logs"))
        );
    }

    #[test]
    fn the_report_fallback_avoids_the_directory_the_per_user_installer_occupies() {
        let Some(local) = std::env::var_os("LOCALAPPDATA") else {
            return;
        };
        let base = PathBuf::from(local);
        let Some(directory) = report_dir() else {
            return;
        };
        if !directory.starts_with(&base) {
            return;
        }

        assert_ne!(directory, base.join("KesVio"));
        assert_eq!(directory, base.join(BUNDLE_IDENTIFIER));
    }

    #[test]
    fn an_unmanaged_or_empty_state_defers_to_the_platform_location() {
        let unresolved = Locations::default();

        assert_eq!(managed_directory(None, Locations::data), None);
        assert_eq!(managed_directory(None, Locations::logs), None);
        assert_eq!(managed_directory(Some(&unresolved), Locations::data), None);
        assert_eq!(managed_directory(Some(&unresolved), Locations::logs), None);
    }
}
