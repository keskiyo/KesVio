use super::corpus::generated_records;
use crate::catalog::machine::{Associations, Registrations};
use crate::catalog::storage::cache::{self, CatalogCache};
use crate::platform::windows::NameScript;
use std::time::{Duration, Instant};

const SAMPLES: usize = 11;

const CATALOG_SIZE: usize = 2000;

struct StageTiming {
    stage: &'static str,
    p50: Duration,
    p95: Duration,
}

fn nearest_rank(sorted: &[Duration], percentile: f64) -> Duration {
    let rank = ((percentile / 100.0) * sorted.len() as f64).ceil() as usize;
    sorted[rank.clamp(1, sorted.len()) - 1]
}

fn measure(stage: &'static str, mut run: impl FnMut()) -> StageTiming {
    run();
    let mut samples = (0..SAMPLES)
        .map(|_| {
            let started = Instant::now();
            run();
            started.elapsed()
        })
        .collect::<Vec<_>>();
    samples.sort_unstable();
    let timing = StageTiming {
        stage,
        p50: nearest_rank(&samples, 50.0),
        p95: nearest_rank(&samples, 95.0),
    };
    println!(
        "{stage}: p50 {:?} p95 {:?} of {samples:?}",
        timing.p50, timing.p95
    );
    timing
}

fn millis(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1000.0
}

#[test]
#[ignore = "developer-only measurement: prints percentiles instead of asserting a threshold"]
fn stage_timings() {
    let records = generated_records(0x5EED, CATALOG_SIZE);
    let registrations = Registrations::empty();
    let associations = Associations::empty();
    println!("catalog: {} records", records.len());

    let mut timings = vec![
        measure("clone only (subtract from the stages below)", || {
            let _ = std::hint::black_box(records.clone());
        }),
        measure("classify entries (visibility and companions)", || {
            let _ = std::hint::black_box(crate::catalog::classify_entries(
                records.clone(),
                &registrations,
            ));
        }),
    ];
    let visible = super::visible_entries(records.clone());
    timings.push(measure(
        "categorize (classify_app per visible record)",
        || {
            for app in &visible {
                let _ = std::hint::black_box(crate::catalog::classify::classify_app(
                    app,
                    &associations,
                ));
            }
        },
    ));
    timings.push(measure("dedup (resolve groups on visible records)", || {
        let _ = std::hint::black_box(crate::catalog::dedup::resolved_groups(visible.clone()));
    }));
    let deduplicated =
        crate::catalog::sanitize_pinned(records.clone(), &registrations, NameScript::Latin);
    timings.push(measure(
        "product duplicates (on the sanitized catalog)",
        || {
            let mut apps = deduplicated.clone();
            crate::catalog::product_duplicates::reject_product_duplicates(
                &mut apps,
                &registrations,
            );
            let _ = std::hint::black_box(apps);
        },
    ));
    timings.push(measure(
        "sanitize (the whole cached-startup pipeline)",
        || {
            let _ = std::hint::black_box(crate::catalog::sanitize_pinned(
                records.clone(),
                &registrations,
                NameScript::Latin,
            ));
        },
    ));

    let directory = tempfile::tempdir().expect("a temporary directory");
    let document = CatalogCache {
        apps: deduplicated,
        ..CatalogCache::default()
    };
    timings.push(measure("cache write", || {
        let _ = cache::write_document(directory.path(), &document);
    }));
    timings.push(measure("cache load", || {
        let _ = std::hint::black_box(cache::read_document(directory.path()));
    }));

    let stages = timings
        .iter()
        .map(|timing| {
            format!(
                r#"{{"stage":"{}","p50Ms":{:.3},"p95Ms":{:.3},"samples":{SAMPLES}}}"#,
                timing.stage,
                millis(timing.p50),
                millis(timing.p95)
            )
        })
        .collect::<Vec<_>>()
        .join(",");
    println!(
        r#"KESVIO_PERF {{"profile":"{}","records":{CATALOG_SIZE},"stages":[{stages}]}}"#,
        if cfg!(debug_assertions) {
            "debug"
        } else {
            "release"
        }
    );
}
