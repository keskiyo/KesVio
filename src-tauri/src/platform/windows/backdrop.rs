use winreg::enums::HKEY_LOCAL_MACHINE;
use winreg::RegKey;

const CURRENT_VERSION_KEY: &str = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion";
const FIRST_MICA_BUILD: u32 = 22000;

pub(crate) fn supports_mica() -> bool {
    mica_available(windows_build())
}

fn windows_build() -> Option<u32> {
    RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(CURRENT_VERSION_KEY)
        .ok()?
        .get_value::<String, _>("CurrentBuildNumber")
        .ok()?
        .trim()
        .parse()
        .ok()
}

fn mica_available(build: Option<u32>) -> bool {
    build.is_some_and(|build| build >= FIRST_MICA_BUILD)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mica_starts_with_windows_11() {
        assert!(!mica_available(Some(19045)));
        assert!(mica_available(Some(22000)));
        assert!(mica_available(Some(26200)));
    }

    #[test]
    fn an_unreadable_build_keeps_the_solid_backdrop() {
        assert!(!mica_available(None));
    }
}
