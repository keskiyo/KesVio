use crate::catalog::AppInfo;
use std::collections::HashMap;

pub(super) fn carry_hydrated_metadata(apps: &mut [AppInfo], previous: &[AppInfo]) -> usize {
    let known = previous
        .iter()
        .map(|app| (app.id.as_str(), app))
        .collect::<HashMap<_, _>>();
    let mut carried = 0;
    for app in apps {
        let Some(earlier) = known.get(app.id.as_str()) else {
            continue;
        };
        if earlier.path != app.path {
            continue;
        }
        let mut changed = false;
        for (field, learned) in [
            (&mut app.description, &earlier.description),
            (&mut app.version, &earlier.version),
            (&mut app.publisher, &earlier.publisher),
            (&mut app.product_name, &earlier.product_name),
            (&mut app.original_filename, &earlier.original_filename),
            (&mut app.install_location, &earlier.install_location),
        ] {
            if field.is_none() && learned.is_some() {
                *field = learned.clone();
                changed = true;
            }
        }
        if changed {
            carried += 1;
        }
    }
    carried
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app_state::cached_app;

    fn hydrated(id: &str, path: &str) -> AppInfo {
        let mut app = cached_app("Tool", path);
        app.id = id.into();
        app.description = Some("A tool".into());
        app.version = Some("2.0".into());
        app.publisher = Some("Vendor".into());
        app.product_name = Some("Tool".into());
        app.original_filename = Some("tool.exe".into());
        app.install_location = Some(r"C:\Tools".into());
        app
    }

    #[test]
    fn a_rescanned_record_keeps_what_hydration_learned() {
        let mut fresh = cached_app("Tool", r"C:\Tools\tool.exe");
        fresh.id = "tool".into();
        let previous = vec![hydrated("tool", r"C:\Tools\tool.exe")];

        assert_eq!(
            carry_hydrated_metadata(std::slice::from_mut(&mut fresh), &previous),
            1
        );

        assert_eq!(fresh.description.as_deref(), Some("A tool"));
        assert_eq!(fresh.version.as_deref(), Some("2.0"));
        assert_eq!(fresh.publisher.as_deref(), Some("Vendor"));
        assert_eq!(fresh.product_name.as_deref(), Some("Tool"));
        assert_eq!(fresh.original_filename.as_deref(), Some("tool.exe"));
        assert_eq!(fresh.install_location.as_deref(), Some(r"C:\Tools"));
    }

    #[test]
    fn a_value_the_source_reported_is_never_replaced_by_the_learned_one() {
        let mut fresh = cached_app("Tool", r"C:\Tools\tool.exe");
        fresh.id = "tool".into();
        fresh.version = Some("3.0".into());
        let previous = vec![hydrated("tool", r"C:\Tools\tool.exe")];

        carry_hydrated_metadata(std::slice::from_mut(&mut fresh), &previous);

        assert_eq!(fresh.version.as_deref(), Some("3.0"));
        assert_eq!(fresh.publisher.as_deref(), Some("Vendor"));
    }

    #[test]
    fn a_record_that_moved_or_is_new_starts_without_learned_metadata() {
        let mut moved = cached_app("Tool", r"D:\Tools\tool.exe");
        moved.id = "tool".into();
        let mut unknown = cached_app("Other", r"C:\Other\other.exe");
        unknown.id = "other".into();
        let previous = vec![hydrated("tool", r"C:\Tools\tool.exe")];

        let mut apps = vec![moved, unknown];

        assert_eq!(carry_hydrated_metadata(&mut apps, &previous), 0);
        assert_eq!(apps[0].version, None);
        assert_eq!(apps[1].version, None);
    }
}
