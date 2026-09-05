use crate::catalog::sync::health::SourceOutcome;

pub(super) fn starting(key: &str) {
    log::info!("Source {key} starting");
}

pub(super) fn finished(outcome: &SourceOutcome) {
    log::info!(
        "Source {} answered={} replaced={} records={} in {}ms stop={:?}",
        outcome.key,
        outcome.answered,
        outcome.replaced,
        outcome.records,
        outcome.duration.as_millis(),
        outcome.stop
    );
}
