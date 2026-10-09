mod elevation;
mod shell;

use crate::catalog::LaunchKind;
use shell::{shell_execute_verb, shell_open};
use std::path::Path;
use windows::Win32::Foundation::{ERROR_CANCELLED, ERROR_NO_ASSOCIATION};

pub(crate) use shell::{wait_for_input_idle, OwnedProcessHandle};

const OPEN_VERB: &str = "open";
const RUNAS_VERB: &str = "runas";

#[derive(Debug)]
pub(crate) enum ElevatedLaunchError {
    Unsupported,
    Cancelled,
    Failed(String),
}

pub(crate) fn launch_elevated(
    kind: LaunchKind,
    target: &str,
    arguments: Option<&str>,
) -> Result<(), ElevatedLaunchError> {
    if is_launch_uri(target) {
        return Err(ElevatedLaunchError::Unsupported);
    }
    let shell_target = match kind {
        LaunchKind::AppUserModelId => apps_folder_target(target),
        LaunchKind::Executable | LaunchKind::Shortcut => {
            if !Path::new(target).exists() {
                return Err(ElevatedLaunchError::Failed(format!(
                    "File not found: {target}"
                )));
            }
            target.to_string()
        }
    };
    shell_execute_verb(
        RUNAS_VERB,
        &shell_target,
        parameters_for(kind, target, arguments),
        working_directory(kind, target).as_deref(),
    )
    .map(|_| ())
    .map_err(elevated_failure)
}

pub(crate) fn supports_elevated_launch(kind: LaunchKind, target: &str) -> bool {
    match kind {
        LaunchKind::AppUserModelId => elevation::shell_item_has_runas(&apps_folder_target(target)),
        LaunchKind::Executable | LaunchKind::Shortcut => !is_launch_uri(target),
    }
}

fn elevated_failure(error: windows::core::Error) -> ElevatedLaunchError {
    if error.code() == ERROR_CANCELLED.to_hresult() {
        ElevatedLaunchError::Cancelled
    } else if error.code() == ERROR_NO_ASSOCIATION.to_hresult() {
        ElevatedLaunchError::Unsupported
    } else {
        ElevatedLaunchError::Failed(format!(
            "Windows Shell could not launch the application elevated (code {})",
            error.code().0
        ))
    }
}

pub(crate) fn launch(
    kind: LaunchKind,
    target: &str,
    arguments: Option<&str>,
) -> Result<Option<OwnedProcessHandle>, String> {
    if kind != LaunchKind::AppUserModelId && !is_launch_uri(target) && !Path::new(target).exists() {
        return Err(format!("File not found: {target}"));
    }
    let shell_target = match kind {
        LaunchKind::AppUserModelId => apps_folder_target(target),
        LaunchKind::Executable | LaunchKind::Shortcut => target.to_string(),
    };
    shell_execute_with_handle(
        &shell_target,
        parameters_for(kind, target, arguments),
        working_directory(kind, target).as_deref(),
    )
}

fn working_directory(kind: LaunchKind, target: &str) -> Option<String> {
    if kind != LaunchKind::Executable || is_launch_uri(target) {
        return None;
    }
    Path::new(target)
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .map(|parent| parent.to_string_lossy().into_owned())
}

fn shell_execute_with_handle(
    target: &str,
    parameters: Option<&str>,
    directory: Option<&str>,
) -> Result<Option<OwnedProcessHandle>, String> {
    shell_execute_verb(OPEN_VERB, target, parameters, directory).map_err(|error| {
        format!(
            "Windows Shell could not launch the application (code {})",
            error.code().0
        )
    })
}

fn parameters_for<'a>(
    kind: LaunchKind,
    target: &str,
    arguments: Option<&'a str>,
) -> Option<&'a str> {
    (kind == LaunchKind::Executable && !is_launch_uri(target))
        .then_some(arguments?.trim())
        .filter(|value| !value.is_empty())
}

pub(crate) fn shell_execute(target: &str) -> Result<(), String> {
    shell_open(
        target,
        working_directory(LaunchKind::Executable, target).as_deref(),
    )
}

fn apps_folder_target(app_id: &str) -> String {
    format!(r"shell:AppsFolder\{app_id}")
}

const LAUNCH_URI_SCHEMES: &[&str] = &["steam:"];

fn is_launch_uri(target: &str) -> bool {
    let target = target.trim().to_ascii_lowercase();
    LAUNCH_URI_SCHEMES
        .iter()
        .any(|scheme| target.starts_with(scheme))
}

#[cfg(test)]
#[path = "tests.rs"]
mod tests;
