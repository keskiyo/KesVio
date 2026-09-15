pub(crate) mod apps_folder;
pub(crate) mod change_watcher;
pub(crate) mod com;
pub(crate) mod drives;
mod execution;
pub(crate) mod icon_extractor;
pub(crate) mod known_folders;
mod locale;
pub(crate) mod process_priority;
mod registry;
mod shortcuts;
pub(crate) mod volume_watcher;
pub(crate) mod volumes;

pub(crate) use execution::{
    close_risk, closer, exec_target, executable_metadata, is_console_subsystem, launcher,
    open_trusted_folder, read_architecture, verify_signature, AppArchitecture, AppSignatureStatus,
    CloseRisk,
};
pub(crate) use locale::{os_ui_script, NameScript};
pub(crate) use registry::{
    associations, install_registry, package_registry, registered_targets, startup_approval,
    steam_registry, uninstall_registry,
};
pub(crate) use shortcuts::{global_shortcut, shortcut};
