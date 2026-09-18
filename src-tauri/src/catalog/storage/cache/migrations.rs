use super::{CatalogCache, CACHE_SCHEMA_VERSION};
use crate::catalog::incremental::FilesystemIndex;
use crate::catalog::{AppCategory, AppInfo, ArtifactKind};

pub(super) fn parse_document(bytes: &[u8], promote_current_schema: bool) -> Option<CatalogCache> {
    if let Ok(mut document) = serde_json::from_slice::<CatalogCache>(bytes) {
        if document.schema_version == CACHE_SCHEMA_VERSION {
            if promote_current_schema {
                let places = crate::catalog::machine::MachineFacts::current();
                promote_cached_artifacts(&mut document, &places);
            }
            return Some(document);
        }
        if matches!(document.schema_version, 2..=10) {
            let places = crate::catalog::machine::MachineFacts::current();
            if document.schema_version < 4 {
                for app in &mut document.apps {
                    crate::catalog::visibility::apply_visibility(app);
                }
            }
            if document.schema_version < 5 {
                document.sources.retain(|snapshot| {
                    snapshot.key.0 != crate::catalog::source::LEGACY_COMBINED_SOURCE
                });
            }
            if document.schema_version < 8 {
                document.app_details.clear();
            }
            if document.schema_version < 9 {
                for app in &mut document.apps {
                    classify_artifact(app, &places);
                }
                document.sources.retain(|snapshot| {
                    !matches!(snapshot.key.0.as_str(), "portable" | "installer-cache")
                });
                for snapshot in &mut document.sources {
                    for app in &mut snapshot.apps {
                        classify_artifact(app, &places);
                    }
                }
                document.filesystem_index = FilesystemIndex::default();
            }
            document.schema_version = CACHE_SCHEMA_VERSION;
            return Some(document);
        }
        return None;
    }
    let mut apps = serde_json::from_slice::<Vec<AppInfo>>(bytes).ok()?;
    let places = crate::catalog::machine::MachineFacts::current();
    for app in &mut apps {
        app.icon_base64 = None;
        classify_artifact(app, &places);
    }
    Some(CatalogCache {
        apps,
        ..CatalogCache::default()
    })
}

fn classify_artifact(app: &mut AppInfo, places: &crate::catalog::machine::MachineFacts) {
    app.artifact_kind = crate::catalog::artifact::classify(app, None, places);
    if app.artifact_kind != ArtifactKind::Application {
        app.category = AppCategory::InstallersDocs;
    }
    crate::catalog::visibility::apply_visibility(app);
}

fn promote_cached_artifacts(
    document: &mut CatalogCache,
    places: &crate::catalog::machine::MachineFacts,
) {
    for app in &mut document.apps {
        promote_artifact(app, places);
    }
    for snapshot in &mut document.sources {
        for app in &mut snapshot.apps {
            promote_artifact(app, places);
        }
    }
    for directory in document.filesystem_index.directories.values_mut() {
        for app in &mut directory.apps {
            promote_artifact(app, places);
        }
    }
}

fn promote_artifact(app: &mut AppInfo, places: &crate::catalog::machine::MachineFacts) {
    if app.artifact_kind != ArtifactKind::Application {
        if app.category != AppCategory::InstallersDocs {
            app.category = AppCategory::InstallersDocs;
            crate::catalog::visibility::apply_visibility(app);
        }
        return;
    }
    let artifact_kind = crate::catalog::artifact::classify(app, None, places);
    if artifact_kind == ArtifactKind::Application {
        return;
    }
    app.artifact_kind = artifact_kind;
    app.category = AppCategory::InstallersDocs;
    crate::catalog::visibility::apply_visibility(app);
}
