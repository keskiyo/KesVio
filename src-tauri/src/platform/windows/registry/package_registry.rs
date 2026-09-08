use std::collections::HashMap;
use winreg::enums::HKEY_LOCAL_MACHINE;
use winreg::RegKey;

const APPLICATION_DATA: &str =
    r"SOFTWARE\Microsoft\Windows\CurrentVersion\AppModel\StateRepository\Cache\Application\Data";
const MAX_APPLICATIONS: usize = 8192;

pub(crate) fn packaged_executables() -> HashMap<String, String> {
    let _operation = crate::diagnostics::Operation::start("package executable registry");
    let mut executables = HashMap::new();
    let root = match RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(APPLICATION_DATA) {
        Ok(root) => root,
        Err(error) => {
            log::warn!(
                "Package registry unavailable: osCode={:?} kind={:?}",
                error.raw_os_error(),
                error.kind()
            );
            return executables;
        }
    };
    for (index, name) in root
        .enum_keys()
        .inspect(|result| {
            if let Err(error) = result {
                log::warn!(
                    "Package registry enumeration error: osCode={:?}",
                    error.raw_os_error()
                );
            }
        })
        .flatten()
        .take(MAX_APPLICATIONS)
        .enumerate()
    {
        log::info!("Package registry entry: index={index}");
        let Ok(entry) = root.open_subkey(&name).inspect_err(|error| {
            log::warn!(
                "Package registry entry unavailable: index={index} osCode={:?}",
                error.raw_os_error()
            );
        }) else {
            continue;
        };
        let (Ok(app_id), Ok(executable)) = (
            entry.get_value::<String, _>("ApplicationUserModelId"),
            entry.get_value::<String, _>("Executable"),
        ) else {
            log::info!(
                "Package registry entry skipped: index={index} missing or invalid string values"
            );
            continue;
        };
        let app_id = app_id.trim();
        let executable = executable.trim();
        if app_id.is_empty() || executable.is_empty() {
            log::info!("Package registry entry skipped: index={index} empty value");
            continue;
        }
        executables.insert(app_id.to_lowercase(), executable.to_string());
    }
    log::info!(
        "Package executable registry returned: records={}",
        executables.len()
    );
    executables
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_packaged_executables_without_panicking() {
        let executables = packaged_executables();

        assert!(executables.len() <= MAX_APPLICATIONS);
        for (app_id, executable) in &executables {
            assert!(!app_id.is_empty());
            assert!(!executable.is_empty());
            assert_eq!(app_id.to_lowercase(), *app_id);
            assert_eq!(executable.trim(), executable);
        }
    }
}
