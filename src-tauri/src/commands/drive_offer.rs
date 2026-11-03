use crate::app_state::{tracked_volumes, AppState};
use crate::catalog::scan_settings;
use crate::catalog::volumes::{folder_letter, volume_key, TrackedVolume};
use crate::error::AppError;
use crate::paths;
use crate::platform::windows::volumes::{self, MountedVolume};
use serde::Serialize;
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DriveOffer {
    id: String,
    letter: String,
    label: String,
}

#[cfg(test)]
pub(super) fn offer_sample() -> DriveOffer {
    DriveOffer {
        id: "1a2b3c4d".into(),
        letter: "F".into(),
        label: "USB".into(),
    }
}

fn offers(
    volumes: Vec<MountedVolume>,
    tracked: &[TrackedVolume],
    paths: &[String],
) -> Vec<DriveOffer> {
    volumes
        .into_iter()
        .filter(|volume| {
            !tracked.iter().any(|entry| {
                entry
                    .serial
                    .eq_ignore_ascii_case(&volume_key(&volume.identity))
            }) && !paths.iter().any(|path| {
                folder_letter(path)
                    .is_some_and(|letter| letter.eq_ignore_ascii_case(&volume.letter))
            })
        })
        .map(|volume| DriveOffer {
            id: volume_key(&volume.identity),
            letter: volume.letter.to_string(),
            label: volume.identity.label.chars().take(80).collect(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::platform::windows::volumes::VolumeIdentity;

    fn volume(letter: char, serial: u32) -> MountedVolume {
        MountedVolume {
            letter,
            identity: VolumeIdentity {
                serial,
                label: "USB".into(),
                filesystem: "FAT32".into(),
            },
        }
    }

    #[test]
    fn offers_only_drives_without_a_configured_folder_or_tracked_identity() {
        let tracked = TrackedVolume {
            folder: r"F:\Apps".into(),
            serial: "00000001".into(),
            label: String::new(),
            filesystem: String::new(),
            mounted_at: None,
        };
        let result = offers(
            vec![volume('G', 1), volume('H', 2), volume('J', 3)],
            &[tracked],
            &[r"H:\Apps".into()],
        );
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].letter, "J");
    }
}

#[tauri::command]
pub(crate) async fn get_untracked_removable_drives(
    app: tauri::AppHandle,
) -> Result<Vec<DriveOffer>, AppError> {
    let directory =
        paths::data_dir(&app).map_err(|error| AppError::AppDataDir(error.to_string()))?;
    let tracked = tracked_volumes(app.state::<AppState>().inner());
    super::run_blocking("Removable drives", move || {
        let settings = scan_settings::read(&directory);
        let mounted = volumes::mounted_volumes()
            .into_iter()
            .filter(|volume| volumes::is_removable_disk(volume.letter))
            .collect();
        offers(mounted, &tracked, &settings.included_paths)
    })
    .await
}
