use sha2::{Digest, Sha256};
use std::path::Path;
use std::sync::OnceLock;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum CloseRisk {
    Safe,
    Session,
    Critical,
}

impl CloseRisk {
    pub(crate) fn id(self) -> Option<&'static str> {
        match self {
            Self::Safe => None,
            Self::Session => Some("close.session"),
            Self::Critical => Some("close.critical"),
        }
    }
}

static CRITICAL: &[u64] = &[
    0xf220_627f_d3d1_20eb,
    0x86a5_1d80_0cf5_f07a,
    0x1f4d_2eef_8842_1562,
    0x050b_ddfe_5597_632d,
    0x37fc_2242_f61e_346c,
    0x657a_2136_fd27_0276,
    0x4af7_c7f8_6757_d338,
    0x8e8e_ab0b_4bfd_c35c,
];

static SESSION: &[u64] = &[
    0x7592_a332_6e8f_8297,
    0x745e_d151_02f4_70ec,
    0x185b_38ec_6613_4f02,
    0x0ca6_0b97_504f_4c28,
    0xa3bf_312f_9c4f_8eba,
    0x3e03_3d31_df27_f15a,
    0x519b_e336_0599_c0dd,
    0xa1f1_85e6_75b6_0ae5,
    0xdb83_7153_e32d_4eed,
    0x635e_f140_bb87_7208,
    0x493c_3e82_79ae_5a30,
    0x50aa_16a2_2569_dd4a,
    0x003b_ebed_35ab_ccaf,
    0xc7e6_e3be_cb34_3cfe,
    0xc7fa_6579_5c36_2767,
];

fn fingerprint(name: &str) -> u64 {
    let digest = Sha256::digest(name.as_bytes());
    let mut head = [0u8; 8];
    for (slot, byte) in head.iter_mut().zip(digest.iter()) {
        *slot = *byte;
    }
    u64::from_be_bytes(head)
}

pub(crate) fn close_risk(path: &Path) -> CloseRisk {
    let Some(name) = file_name(path) else {
        return CloseRisk::Safe;
    };
    let name = fingerprint(&name);
    if CRITICAL.contains(&name) {
        return CloseRisk::Critical;
    }
    if SESSION.contains(&name) || is_this_launcher(path) {
        return CloseRisk::Session;
    }
    CloseRisk::Safe
}

fn file_name(path: &Path) -> Option<String> {
    path.file_name()
        .map(|name| name.to_string_lossy().to_lowercase())
}

fn is_this_launcher(path: &Path) -> bool {
    static OWN: OnceLock<Option<String>> = OnceLock::new();
    let own = OWN.get_or_init(|| std::env::current_exe().ok().as_deref().and_then(file_name));
    own.as_deref() == file_name(path).as_deref()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    const CRITICAL_NAMES: &[&str] = &[
        "smss.exe",
        "csrss.exe",
        "wininit.exe",
        "winlogon.exe",
        "services.exe",
        "lsass.exe",
        "lsaiso.exe",
        "svchost.exe",
    ];

    const SESSION_NAMES: &[&str] = &[
        "explorer.exe",
        "dwm.exe",
        "sihost.exe",
        "ctfmon.exe",
        "taskhostw.exe",
        "startmenuexperiencehost.exe",
        "shellexperiencehost.exe",
        "searchhost.exe",
        "searchapp.exe",
        "textinputhost.exe",
        "applicationframehost.exe",
        "runtimebroker.exe",
        "dllhost.exe",
        "rundll32.exe",
        "conhost.exe",
    ];

    #[test]
    fn terminating_these_ends_windows() {
        for name in CRITICAL_NAMES {
            let path = PathBuf::from(r"C:\Windows\System32").join(name);
            assert_eq!(close_risk(&path), CloseRisk::Critical, "{name}");
        }
    }

    #[test]
    fn terminating_these_ends_the_desktop_session() {
        for name in SESSION_NAMES {
            let path = PathBuf::from(r"C:\Windows").join(name);
            assert_eq!(close_risk(&path), CloseRisk::Session, "{name}");
        }
    }

    #[test]
    fn every_protected_entry_is_covered_by_a_named_process() {
        assert_eq!(CRITICAL.len(), CRITICAL_NAMES.len());
        assert_eq!(SESSION.len(), SESSION_NAMES.len());
        for (entry, name) in CRITICAL.iter().zip(CRITICAL_NAMES) {
            assert_eq!(*entry, fingerprint(name), "{name}");
        }
        for (entry, name) in SESSION.iter().zip(SESSION_NAMES) {
            assert_eq!(*entry, fingerprint(name), "{name}");
        }
    }

    #[test]
    fn an_ordinary_application_is_safe_to_close() {
        for path in [
            r"C:\Program Files\Editor\editor.exe",
            r"C:\Windows\System32\notepad.exe",
            r"C:\Windows\System32\mspaint.exe",
            r"D:\Games\game.exe",
        ] {
            assert_eq!(close_risk(Path::new(path)), CloseRisk::Safe, "{path}");
        }
    }

    #[test]
    fn the_verdict_does_not_depend_on_how_the_path_is_written() {
        for path in [
            r"C:\Windows\explorer.exe",
            r"c:\windows\EXPLORER.EXE",
            r"C:/Windows/Explorer.Exe",
        ] {
            assert_eq!(close_risk(Path::new(path)), CloseRisk::Session, "{path}");
        }
    }

    #[test]
    fn closing_the_launcher_from_its_own_scenario_is_a_session_risk() {
        let own = std::env::current_exe().expect("the test binary has a path");

        assert_eq!(close_risk(&own), CloseRisk::Session);
    }

    #[test]
    fn a_path_with_no_file_name_is_not_a_target() {
        assert_eq!(close_risk(Path::new(r"C:\")), CloseRisk::Safe);
    }

    #[test]
    fn every_risk_above_safe_carries_a_distinct_stable_identifier() {
        assert_eq!(CloseRisk::Safe.id(), None);
        assert_eq!(CloseRisk::Session.id(), Some("close.session"));
        assert_eq!(CloseRisk::Critical.id(), Some("close.critical"));
    }

    #[test]
    fn no_name_is_listed_in_both_tiers() {
        for entry in SESSION {
            assert!(!CRITICAL.contains(entry));
        }
    }
}
