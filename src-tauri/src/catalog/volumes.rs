use crate::platform::windows::volumes::{MountedVolume, VolumeIdentity};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TrackedVolume {
    pub folder: String,
    pub serial: String,
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub filesystem: String,
    #[serde(default)]
    pub mounted_at: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ResolvedFolder {
    pub configured: String,
    pub path: String,
    pub volume: Option<String>,
}

pub(crate) struct FolderResolution {
    pub folders: Vec<ResolvedFolder>,
    pub tracked: Vec<TrackedVolume>,
}

pub(crate) fn volume_key(identity: &VolumeIdentity) -> String {
    format!("{:08x}", identity.serial)
}

pub(crate) fn folder_letter(folder: &str) -> Option<char> {
    let mut characters = folder.trim().chars();
    let letter = characters.next()?;
    (letter.is_ascii_alphabetic() && characters.next() == Some(':')).then_some(letter)
}

pub(crate) fn resolve_folders(
    included_paths: &[String],
    tracked: &[TrackedVolume],
    mounted: &[MountedVolume],
) -> FolderResolution {
    let mut folders = Vec::with_capacity(included_paths.len());
    let mut next_tracked = Vec::new();
    for configured in included_paths {
        let Some(letter) = folder_letter(configured) else {
            folders.push(unresolved(configured));
            continue;
        };
        let entry = tracked
            .iter()
            .find(|entry| same_folder(&entry.folder, configured));
        let here = mounted
            .iter()
            .find(|volume| volume.letter.eq_ignore_ascii_case(&letter));
        match (here, entry) {
            (Some(here), Some(entry)) if same_serial(entry, &here.identity) => {
                folders.push(resolved(configured, configured, &here.identity));
                next_tracked.push(tracked_at(configured, &here.identity, configured));
            }
            (Some(here), Some(entry)) => {
                log::warn!(
                    "Scan folder {configured} now holds volume {} ({:?}) instead of tracked {} ({:?}): remove and re-add the folder to follow the new volume",
                    volume_key(&here.identity),
                    here.identity.label,
                    entry.serial,
                    entry.label
                );
                folders.push(resolved(configured, configured, &here.identity));
                next_tracked.push(TrackedVolume {
                    mounted_at: None,
                    ..entry.clone()
                });
            }
            (Some(here), None) => {
                folders.push(resolved(configured, configured, &here.identity));
                next_tracked.push(tracked_at(configured, &here.identity, configured));
            }
            (None, Some(entry)) => {
                let candidates = mounted
                    .iter()
                    .filter(|volume| same_serial(entry, &volume.identity))
                    .collect::<Vec<_>>();
                match candidates.as_slice() {
                    [only] => {
                        let path = relocated(configured, only.letter);
                        log::info!(
                            "Scan folder {configured} follows volume {} ({:?}) to {path}",
                            entry.serial,
                            entry.label
                        );
                        folders.push(resolved(configured, &path, &only.identity));
                        next_tracked.push(tracked_at(configured, &only.identity, &path));
                    }
                    [] => {
                        folders.push(unresolved(configured));
                        next_tracked.push(TrackedVolume {
                            mounted_at: None,
                            ..entry.clone()
                        });
                    }
                    several => {
                        log::warn!(
                            "Scan folder {configured} is not remapped: volume {} is mounted at {} letters ({})",
                            entry.serial,
                            several.len(),
                            several
                                .iter()
                                .map(|volume| volume.letter.to_string())
                                .collect::<Vec<_>>()
                                .join(", ")
                        );
                        folders.push(unresolved(configured));
                        next_tracked.push(TrackedVolume {
                            mounted_at: None,
                            ..entry.clone()
                        });
                    }
                }
            }
            (None, None) => folders.push(unresolved(configured)),
        }
    }
    FolderResolution {
        folders,
        tracked: next_tracked,
    }
}

fn unresolved(configured: &str) -> ResolvedFolder {
    ResolvedFolder {
        configured: configured.to_owned(),
        path: configured.to_owned(),
        volume: None,
    }
}

fn resolved(configured: &str, path: &str, identity: &VolumeIdentity) -> ResolvedFolder {
    ResolvedFolder {
        configured: configured.to_owned(),
        path: path.to_owned(),
        volume: Some(volume_key(identity)),
    }
}

fn tracked_at(configured: &str, identity: &VolumeIdentity, path: &str) -> TrackedVolume {
    TrackedVolume {
        folder: configured.to_owned(),
        serial: volume_key(identity),
        label: identity.label.clone(),
        filesystem: identity.filesystem.clone(),
        mounted_at: Some(path.to_owned()),
    }
}

fn same_serial(entry: &TrackedVolume, identity: &VolumeIdentity) -> bool {
    entry.serial.eq_ignore_ascii_case(&volume_key(identity))
}

fn same_folder(left: &str, right: &str) -> bool {
    left.trim().eq_ignore_ascii_case(right.trim())
}

fn relocated(configured: &str, letter: char) -> String {
    let mut path = letter.to_ascii_uppercase().to_string();
    path.extend(configured.trim().chars().skip(1));
    path
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mounted(letter: char, serial: u32, label: &str) -> MountedVolume {
        MountedVolume {
            letter,
            identity: VolumeIdentity {
                serial,
                label: label.into(),
                filesystem: "FAT32".into(),
            },
        }
    }

    fn tracked(folder: &str, serial: &str) -> TrackedVolume {
        TrackedVolume {
            folder: folder.into(),
            serial: serial.into(),
            label: "STICK".into(),
            filesystem: "FAT32".into(),
            mounted_at: Some(folder.into()),
        }
    }

    fn paths(folders: &[&str]) -> Vec<String> {
        folders.iter().map(|folder| (*folder).to_owned()).collect()
    }

    #[test]
    fn a_folder_whose_letter_is_mounted_is_learned_with_the_volume_that_is_there() {
        let resolution =
            resolve_folders(&paths(&[r"F:\"]), &[], &[mounted('F', 0x1a2b3c4d, "STICK")]);

        assert_eq!(
            resolution.folders,
            vec![ResolvedFolder {
                configured: r"F:\".into(),
                path: r"F:\".into(),
                volume: Some("1a2b3c4d".into()),
            }]
        );
        assert_eq!(
            resolution.tracked,
            vec![TrackedVolume {
                folder: r"F:\".into(),
                serial: "1a2b3c4d".into(),
                label: "STICK".into(),
                filesystem: "FAT32".into(),
                mounted_at: Some(r"F:\".into()),
            }]
        );
    }

    #[test]
    fn a_tracked_volume_that_moved_to_another_letter_is_followed_there() {
        let resolution = resolve_folders(
            &paths(&[r"F:\Apps"]),
            &[tracked(r"F:\Apps", "1a2b3c4d")],
            &[
                mounted('C', 0x11111111, ""),
                mounted('G', 0x1a2b3c4d, "STICK"),
            ],
        );

        assert_eq!(
            resolution.folders,
            vec![ResolvedFolder {
                configured: r"F:\Apps".into(),
                path: r"G:\Apps".into(),
                volume: Some("1a2b3c4d".into()),
            }]
        );
        assert_eq!(
            resolution.tracked[0].mounted_at.as_deref(),
            Some(r"G:\Apps")
        );
        assert_eq!(resolution.tracked[0].folder, r"F:\Apps");
    }

    #[test]
    fn a_serial_mounted_at_two_letters_is_ambiguous_and_is_not_remapped() {
        let resolution = resolve_folders(
            &paths(&[r"F:\"]),
            &[tracked(r"F:\", "1a2b3c4d")],
            &[
                mounted('G', 0x1a2b3c4d, "STICK"),
                mounted('H', 0x1a2b3c4d, "STICK"),
            ],
        );

        assert_eq!(resolution.folders[0].path, r"F:\");
        assert_eq!(resolution.folders[0].volume, None);
        assert_eq!(resolution.tracked[0].mounted_at, None);
        assert_eq!(resolution.tracked[0].serial, "1a2b3c4d");
    }

    #[test]
    fn a_reformatted_or_foreign_volume_at_the_letter_gets_its_own_key_and_keeps_the_entry() {
        let resolution = resolve_folders(
            &paths(&[r"F:\"]),
            &[tracked(r"F:\", "1a2b3c4d")],
            &[mounted('F', 0x9f9f9f9f, "NEW")],
        );

        assert_eq!(resolution.folders[0].volume.as_deref(), Some("9f9f9f9f"));
        assert_eq!(resolution.folders[0].path, r"F:\");
        assert_eq!(resolution.tracked[0].serial, "1a2b3c4d");
        assert_eq!(resolution.tracked[0].mounted_at, None);
    }

    #[test]
    fn an_absent_volume_leaves_the_folder_unresolved_and_the_entry_waiting() {
        let resolution = resolve_folders(
            &paths(&[r"F:\"]),
            &[tracked(r"F:\", "1a2b3c4d")],
            &[mounted('C', 0x11111111, "")],
        );

        assert_eq!(resolution.folders[0].path, r"F:\");
        assert_eq!(resolution.folders[0].volume, None);
        assert_eq!(resolution.tracked.len(), 1);
        assert_eq!(resolution.tracked[0].mounted_at, None);
    }

    #[test]
    fn a_letter_whose_identity_cannot_be_read_is_scanned_without_a_volume() {
        let resolution = resolve_folders(&paths(&[r"F:\"]), &[], &[]);

        assert_eq!(resolution.folders, vec![unresolved(r"F:\")]);
        assert!(resolution.tracked.is_empty());
    }

    #[test]
    fn network_and_relative_folders_are_never_volumes() {
        let resolution = resolve_folders(
            &paths(&[r"\\server\share", "Tools"]),
            &[tracked(r"\\server\share", "1a2b3c4d")],
            &[mounted('G', 0x1a2b3c4d, "STICK")],
        );

        assert_eq!(
            resolution.folders,
            vec![unresolved(r"\\server\share"), unresolved("Tools")]
        );
        assert!(resolution.tracked.is_empty());
    }

    #[test]
    fn an_entry_for_a_folder_that_left_the_settings_is_dropped() {
        let resolution = resolve_folders(
            &paths(&[r"D:\Apps"]),
            &[tracked(r"F:\", "1a2b3c4d")],
            &[
                mounted('G', 0x1a2b3c4d, "STICK"),
                mounted('D', 0x22222222, "DATA"),
            ],
        );

        assert_eq!(resolution.folders[0].path, r"D:\Apps");
        assert_eq!(resolution.tracked.len(), 1);
        assert_eq!(resolution.tracked[0].folder, r"D:\Apps");
    }

    #[test]
    fn folders_and_letters_match_regardless_of_case() {
        let resolution = resolve_folders(
            &paths(&[r"f:\apps"]),
            &[tracked(r"F:\Apps", "1A2B3C4D")],
            &[mounted('G', 0x1a2b3c4d, "STICK")],
        );

        assert_eq!(resolution.folders[0].path, r"G:\apps");
        assert_eq!(resolution.folders[0].volume.as_deref(), Some("1a2b3c4d"));
    }
}
