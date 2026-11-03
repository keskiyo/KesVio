use crate::catalog::volumes::TrackedVolume;
use crate::catalog::{self, AppInfo};

pub(super) fn retain_offline_apps(
    apps: &mut Vec<AppInfo>,
    previous: &[AppInfo],
    tracked: &[TrackedVolume],
    previous_volumes: &[TrackedVolume],
    excluded: &[String],
) {
    let mut offline_apps = Vec::new();
    for app in previous {
        if excluded
            .iter()
            .any(|path| catalog::path_is_within(&app.path.to_lowercase(), &path.to_lowercase()))
        {
            continue;
        }
        let Some(volume) = tracked.iter().find(|volume| {
            volume.mounted_at.is_none()
                && app
                    .volume_id
                    .as_deref()
                    .is_some_and(|id| id.eq_ignore_ascii_case(&volume.serial))
                && app.scan_folder.as_deref().is_some_and(|folder| {
                    folder.eq_ignore_ascii_case(&volume.folder)
                        || previous_volumes.iter().any(|old| {
                            old.folder.eq_ignore_ascii_case(&volume.folder)
                                && old
                                    .mounted_at
                                    .as_deref()
                                    .is_some_and(|mounted| mounted.eq_ignore_ascii_case(folder))
                        })
                })
        }) else {
            continue;
        };
        let mut offline = app.clone();
        offline.scan_folder = Some(volume.folder.clone());
        offline.target_availability = Some("target.unverifiable.unmounted_volume".into());
        offline_apps.push(offline);
    }
    let offline_ids = offline_apps
        .iter()
        .map(|app| app.id.as_str())
        .collect::<std::collections::HashSet<_>>();
    apps.retain(|app| !offline_ids.contains(app.id.as_str()));
    apps.extend(offline_apps);
}
