use crate::catalog::cache::{self, CatalogCache};
use crate::catalog::{self, AppInfo};
use std::path::Path;

pub(crate) fn load_sanitized_document(app_data_dir: &Path) -> Option<CatalogCache> {
    let mut document = cache::read_document(app_data_dir)?;
    let original = document.apps.clone();
    document.apps = catalog::sanitize(document.apps);
    document.app_details =
        crate::catalog::details::retain_cached_details(&document.app_details, &document.apps);
    if document.apps != original && !newer_generation_on_disk(app_data_dir, document.generation) {
        let _ = cache::write_document(app_data_dir, &document);
    }
    for app in &mut document.apps {
        app.icon_base64 = None;
    }
    Some(document)
}

fn newer_generation_on_disk(app_data_dir: &Path, generation: u64) -> bool {
    cache::stored_generation(app_data_dir).is_some_and(|current| current > generation)
}

pub(crate) fn load_sanitized_cache(app_data_dir: &Path) -> Option<Vec<AppInfo>> {
    load_sanitized_document(app_data_dir).map(|document| document.apps)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app_state::cached_app;
    use crate::catalog::cache::CachedAppDetails;
    use crate::catalog::AppDetails;
    use std::collections::BTreeMap;

    const CACHED_ICON: &str = "data:image/png;base64,cached";

    fn with_icon(name: &str, path: &str) -> crate::catalog::AppInfo {
        let mut app = cached_app(name, path);
        app.icon_base64 = Some(CACHED_ICON.into());
        app
    }

    fn settled(apps: Vec<crate::catalog::AppInfo>) -> Vec<crate::catalog::AppInfo> {
        let mut settled = crate::catalog::sanitize(apps);
        for app in &mut settled {
            app.icon_base64 = Some(CACHED_ICON.into());
        }
        settled
    }

    // Hydration writes the icons back into the document, so the next load found records that
    // differed from their sanitized form only by an icon and rewrote the whole file to strip them.
    // On a real catalog that is a ten megabyte write per scan cycle, and it also threw away the
    // icons hydration had just persisted.
    #[test]
    fn a_settled_document_is_not_rewritten_to_strip_its_icons() {
        let dir = tempfile::tempdir().unwrap();
        cache::write_document(
            dir.path(),
            &CatalogCache {
                apps: settled(vec![with_icon("Editor", r"C:\Editor.exe")]),
                ..CatalogCache::default()
            },
        )
        .unwrap();
        let path = dir.path().join("apps-cache.json");
        let before = std::fs::read(&path).unwrap();

        let loaded = load_sanitized_document(dir.path()).unwrap();

        assert!(loaded.apps.iter().all(|app| app.icon_base64.is_none()));
        assert_eq!(std::fs::read(&path).unwrap(), before);
    }

    #[test]
    fn a_rewritten_document_keeps_the_icons_the_caller_does_not_receive() {
        let dir = tempfile::tempdir().unwrap();
        let mut shell_shortcut = with_icon("Windows Kits", r"C:\Menu\Windows Kits.lnk");
        shell_shortcut.resolved_path = Some(r"C:\Windows\explorer.exe".into());
        shell_shortcut.launch_arguments =
            Some(r#""C:\Program Files (x86)\Windows Kits\10\""#.into());
        cache::write_document(
            dir.path(),
            &CatalogCache {
                apps: vec![shell_shortcut, with_icon("Editor", r"C:\Editor.exe")],
                ..CatalogCache::default()
            },
        )
        .unwrap();

        let loaded = load_sanitized_document(dir.path()).unwrap();

        assert!(loaded.apps.iter().all(|app| app.icon_base64.is_none()));
        let stored = cache::read_document(dir.path()).unwrap();
        assert_eq!(stored.apps.len(), 1);
        assert_eq!(stored.apps[0].icon_base64.as_deref(), Some(CACHED_ICON));
    }

    #[test]
    fn loads_and_persists_a_sanitized_cache() {
        let dir = tempfile::tempdir().unwrap();
        let mut shell_shortcut = cached_app("Windows Kits", r"C:\Menu\Windows Kits.lnk");
        shell_shortcut.resolved_path = Some(r"C:\Windows\explorer.exe".into());
        shell_shortcut.launch_arguments =
            Some(r#""C:\Program Files (x86)\Windows Kits\10\""#.into());
        cache::write_document(
            dir.path(),
            &CatalogCache {
                apps: vec![
                    shell_shortcut,
                    cached_app("Visual Studio Code", r"C:\Code.exe"),
                ],
                ..CatalogCache::default()
            },
        )
        .unwrap();
        let apps = load_sanitized_cache(dir.path()).unwrap();
        assert_eq!(apps.len(), 1);
        assert_eq!(cache::read_document(dir.path()).unwrap().apps.len(), 1);
    }

    #[test]
    fn sanitize_write_back_does_not_replace_a_newer_generation() {
        let dir = tempfile::tempdir().unwrap();
        cache::write_document(
            dir.path(),
            &CatalogCache {
                generation: 9,
                apps: vec![cached_app("Editor", r"C:\Editor.exe")],
                ..CatalogCache::default()
            },
        )
        .unwrap();

        assert!(newer_generation_on_disk(dir.path(), 8));
        assert!(!newer_generation_on_disk(dir.path(), 9));
        assert!(!newer_generation_on_disk(dir.path(), 10));
    }

    #[test]
    fn sanitize_write_back_is_skipped_when_the_cache_moved_ahead() {
        let dir = tempfile::tempdir().unwrap();
        let stale = CatalogCache {
            generation: 1,
            apps: vec![
                cached_app(
                    "Visual Studio Installer",
                    "Microsoft.VisualStudio.Installer",
                ),
                cached_app("Editor", r"C:\Editor.exe"),
            ],
            ..CatalogCache::default()
        };
        cache::write_document(
            dir.path(),
            &CatalogCache {
                generation: 7,
                apps: vec![cached_app("Editor", r"C:\Editor.exe")],
                ..CatalogCache::default()
            },
        )
        .unwrap();

        assert!(newer_generation_on_disk(dir.path(), stale.generation));
        assert_eq!(cache::read_document(dir.path()).unwrap().generation, 7);
    }

    #[test]
    fn a_registered_product_keeps_its_flag_and_its_score_across_a_cache_round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let mut app = cached_app("Editor", r"C:\Editor.exe");
        app.can_uninstall = true;
        crate::catalog::visibility::apply_visibility(&mut app);
        let scored = app.visibility_score;
        assert!(app
            .visibility_reasons
            .contains(&crate::catalog::VisibilityReason::RegisteredProduct));
        cache::write_document(
            dir.path(),
            &CatalogCache {
                apps: vec![app],
                ..CatalogCache::default()
            },
        )
        .unwrap();

        let apps = load_sanitized_cache(dir.path()).unwrap();

        assert!(apps[0].can_uninstall);
        assert_eq!(apps[0].visibility_score, scored);
        assert!(apps[0]
            .visibility_reasons
            .contains(&crate::catalog::VisibilityReason::RegisteredProduct));
    }

    #[test]
    fn sanitize_write_back_removes_details_for_removed_cards_only() {
        let dir = tempfile::tempdir().unwrap();
        let mut removed = cached_app(
            "Visual Studio Installer",
            "Microsoft.VisualStudio.Installer",
        );
        removed.id = "removed".into();
        let mut kept = cached_app("Editor", r"C:\Editor.exe");
        let kept_id = crate::catalog::sanitize(vec![kept.clone()])
            .pop()
            .unwrap()
            .id;
        kept.id = kept_id.clone();
        let cached = |fingerprint: &str| CachedAppDetails {
            fingerprint: fingerprint.into(),
            details: AppDetails::default(),
        };
        cache::write_document(
            dir.path(),
            &CatalogCache {
                apps: vec![removed, kept],
                app_details: BTreeMap::from([
                    ("removed".into(), cached("old")),
                    (kept_id.clone(), cached("current")),
                ]),
                ..CatalogCache::default()
            },
        )
        .unwrap();

        let document = load_sanitized_document(dir.path()).unwrap();

        assert!(document.app_details.contains_key(&kept_id));
        assert!(!document.app_details.contains_key("removed"));
    }
}
