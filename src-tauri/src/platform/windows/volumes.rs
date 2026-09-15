use std::path::Path;
use windows::core::PCWSTR;
use windows::Win32::Storage::FileSystem::{GetDriveTypeW, GetLogicalDrives, GetVolumeInformationW};

const DRIVE_REMOVABLE_TYPE: u32 = 2;
const DRIVE_FIXED_TYPE: u32 = 3;
const NAME_BUFFER: usize = 261;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct VolumeIdentity {
    pub serial: u32,
    pub label: String,
    pub filesystem: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct MountedVolume {
    pub letter: char,
    pub identity: VolumeIdentity,
}

pub(crate) fn volume_identity(root: &Path) -> Option<VolumeIdentity> {
    let mut root = root.as_os_str().to_string_lossy().into_owned();
    if !root.ends_with('\\') {
        root.push('\\');
    }
    let wide = root.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
    let mut label = [0u16; NAME_BUFFER];
    let mut filesystem = [0u16; NAME_BUFFER];
    let mut serial = 0u32;
    // SAFETY: `PCWSTR` must point at a NUL-terminated UTF-16 string that outlives the call; `wide`
    // is built here with an explicit trailing NUL and is not moved until the call returns. The two
    // name buffers are passed as slices whose lengths the wrapper forwards, so the function cannot
    // write past them, and `serial` outlives the call and is written through a valid pointer.
    unsafe {
        GetVolumeInformationW(
            PCWSTR(wide.as_ptr()),
            Some(&mut label),
            Some(&mut serial),
            None,
            None,
            Some(&mut filesystem),
        )
    }
    .ok()?;
    Some(VolumeIdentity {
        serial,
        label: wide_to_string(&label),
        filesystem: wide_to_string(&filesystem),
    })
}

pub(crate) fn mounted_volumes() -> Vec<MountedVolume> {
    // SAFETY: `GetLogicalDrives` takes no arguments and reads no caller memory. It returns 0 on
    // failure, which the bit test below treats as "no drives" rather than as an error.
    let mask = unsafe { GetLogicalDrives() };
    (0..26u8)
        .filter(|index| mask & (1 << index) != 0)
        .map(|index| char::from(b'A' + index))
        .filter(|letter| is_local_disk(*letter))
        .filter_map(|letter| {
            let identity = volume_identity(Path::new(&format!(r"{letter}:\")))?;
            Some(MountedVolume { letter, identity })
        })
        .collect()
}

fn is_local_disk(letter: char) -> bool {
    let root = format!(r"{letter}:\");
    let wide = root.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
    // SAFETY: `PCWSTR` must point at a NUL-terminated UTF-16 string that outlives the call; `wide`
    // is built here with an explicit trailing NUL and stays alive until the call returns.
    let kind = unsafe { GetDriveTypeW(PCWSTR(wide.as_ptr())) };
    matches!(kind, DRIVE_REMOVABLE_TYPE | DRIVE_FIXED_TYPE)
}

fn wide_to_string(buffer: &[u16]) -> String {
    let end = buffer
        .iter()
        .position(|unit| *unit == 0)
        .unwrap_or(buffer.len());
    String::from_utf16_lossy(&buffer[..end])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_name_buffer_ends_at_its_first_nul() {
        let mut buffer = [0u16; 8];
        for (slot, unit) in buffer.iter_mut().zip("USB\0DISK".encode_utf16()) {
            *slot = unit;
        }
        assert_eq!(wide_to_string(&buffer), "USB");
        assert_eq!(wide_to_string(&[0u16; 4]), "");
        assert_eq!(
            wide_to_string(&"NTFS".encode_utf16().collect::<Vec<_>>()),
            "NTFS"
        );
    }

    #[test]
    fn the_system_drive_reports_a_serial_and_a_filesystem() {
        let root = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".into());
        let identity = volume_identity(Path::new(&root)).expect("the system drive is mounted");
        assert!(!identity.filesystem.is_empty());
        assert!(mounted_volumes().iter().any(|volume| {
            root.starts_with(volume.letter) && volume.identity.serial == identity.serial
        }));
    }
}
