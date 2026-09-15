use super::log_sink::LogSink;
use std::path::PathBuf;
use tauri::plugin::TauriPlugin;
use tauri::Runtime;
use tauri_plugin_log::{fern, Builder, Target, TargetKind, TimezoneStrategy};

pub(crate) fn plugin<R: Runtime>(directory: Option<PathBuf>) -> (TauriPlugin<R>, LogSink) {
    let sink = LogSink::new(directory);
    let files = fern::Dispatch::new().chain(sink.output());
    let plugin = Builder::default()
        .level(log::LevelFilter::Info)
        .clear_targets()
        .targets([
            Target::new(TargetKind::Stdout),
            Target::new(TargetKind::Dispatch(files)),
        ])
        .timezone_strategy(TimezoneStrategy::UseLocal)
        .build();
    (plugin, sink)
}
