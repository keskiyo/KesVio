use std::path::PathBuf;
use tauri::plugin::TauriPlugin;
use tauri::Runtime;
use tauri_plugin_log::{Builder, RotationStrategy, Target, TargetKind, TimezoneStrategy};

pub(crate) const LOG_FILE_STEM: &str = "kesvio";

const MAX_LOG_FILE_BYTES: u128 = 4 * 1024 * 1024;
const KEPT_LOG_FILES: usize = 8;

fn file_target(directory: Option<PathBuf>) -> TargetKind {
    let file_name = Some(LOG_FILE_STEM.to_string());
    match directory {
        Some(path) => TargetKind::Folder { path, file_name },
        None => TargetKind::LogDir { file_name },
    }
}

pub(crate) fn plugin<R: Runtime>(directory: Option<PathBuf>) -> TauriPlugin<R> {
    Builder::default()
        .level(log::LevelFilter::Info)
        .clear_targets()
        .targets([
            Target::new(TargetKind::Stdout),
            Target::new(file_target(directory)),
        ])
        .rotation_strategy(RotationStrategy::KeepSome(KEPT_LOG_FILES))
        .max_file_size(MAX_LOG_FILE_BYTES)
        .timezone_strategy(TimezoneStrategy::UseLocal)
        .build()
}
