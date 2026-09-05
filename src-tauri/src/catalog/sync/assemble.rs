use crate::catalog::cache::{CatalogCache, CatalogDiagnostics};
use crate::catalog::scan_settings::ScanSettings;
use crate::catalog::source::{apply_health, merge_sources};
use crate::catalog::sync::delta::compute_delta;
use crate::catalog::sync::health::{seconds_since_epoch, source_health};
use crate::catalog::sync::scan_sources::SourceScan;
use crate::catalog::sync::scan_steps::StepTracker;
use crate::catalog::sync::SyncRequest;
use crate::catalog::{self, AppInfo};
use std::collections::BTreeMap;
use std::time::Instant;

const ASSEMBLE: &str = "assemble";

pub(super) fn assemble(
    previous: &CatalogCache,
    scan: SourceScan,
    settings: &ScanSettings,
    request: SyncRequest,
    started_at: Instant,
    attempted_at: u64,
    steps: &StepTracker,
) -> CatalogCache {
    steps.mark(ASSEMBLE, "source health");
    let health = scan
        .outcomes
        .into_iter()
        .map(|outcome| source_health(&previous.sources, outcome, attempted_at))
        .collect::<Vec<_>>();
    steps.mark(ASSEMBLE, "merge sources");
    let merged = merge_sources(previous.sources.clone(), scan.updates);
    let mut sources = merged.sources;
    apply_health(&mut sources, health.clone());

    let mut apps = merged.apps;
    if let Some(metadata) = &scan.registry_metadata {
        steps.mark(ASSEMBLE, "registry metadata");
        catalog::attach_registry_metadata(&mut apps, metadata);
    }
    steps.mark(ASSEMBLE, "target availability");
    let target_availability = catalog::retain_present_targets(&mut apps, settings);
    steps.mark(ASSEMBLE, "sanitize and deduplicate");
    apps = catalog::sanitize_reported(apps);
    steps.mark(ASSEMBLE, "console applications");
    catalog::demote_console_applications(&mut apps);
    steps.mark(ASSEMBLE, "category reasons");
    catalog::attach_category_reasons(&mut apps);
    steps.mark(ASSEMBLE, "close risk");
    catalog::attach_close_risk(&mut apps);
    for app in &mut apps {
        app.icon_base64 = None;
    }

    steps.mark(ASSEMBLE, "catalog delta");
    let completed_at = seconds_since_epoch();
    let delta = compute_delta(previous.generation.saturating_add(1), &previous.apps, &apps);
    let diagnostics = CatalogDiagnostics {
        completed_at,
        duration_ms: started_at
            .elapsed()
            .as_millis()
            .try_into()
            .unwrap_or(u64::MAX),
        mode: request.label().into(),
        total_apps: apps.len(),
        source_counts: counted(&apps, |app| format!("{:?}", app.source_kind)),
        visibility_counts: counted(&apps, |app| format!("{:?}", app.visibility_class)),
        added: delta.summary.added,
        removed: delta.summary.removed,
        updated: delta.summary.updated,
        sources: health,
        target_availability,
    };
    log::info!(
        "Scan finished: mode={} {}ms apps={} added={} updated={} removed={} sources={:?}",
        diagnostics.mode,
        diagnostics.duration_ms,
        diagnostics.total_apps,
        diagnostics.added,
        diagnostics.updated,
        diagnostics.removed,
        diagnostics.source_counts
    );
    steps.mark(ASSEMBLE, "cached details");
    let app_details = catalog::details::retain_cached_details(&previous.app_details, &apps);

    CatalogCache {
        schema_version: crate::catalog::cache::CACHE_SCHEMA_VERSION,
        generation: previous.generation.saturating_add(1),
        apps,
        sources,
        filesystem_index: scan
            .filesystem_index
            .unwrap_or_else(|| previous.filesystem_index.clone()),
        last_successful_sync: Some(completed_at),
        diagnostics: Some(diagnostics),
        app_details,
    }
}

fn counted(apps: &[AppInfo], key: impl Fn(&AppInfo) -> String) -> BTreeMap<String, usize> {
    let mut counts = BTreeMap::new();
    for app in apps {
        *counts.entry(key(app).to_lowercase()).or_insert(0) += 1;
    }
    counts
}
