#![deny(unreachable_pub)]

mod app_state;
mod catalog;
mod commands;
mod diagnostics;
mod error;
mod lifecycle;
mod platform;

use std::sync::Arc;
use tauri::Manager;

use app_state::AppState;
use lifecycle::window_state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let lifecycle = Arc::new(lifecycle::LifecycleState::default());
    let starts_hidden_from_autostart = lifecycle::starts_hidden_from_autostart(std::env::args_os());
    let window_lifecycle = Arc::clone(&lifecycle);
    let tray_lifecycle = Arc::clone(&lifecycle);
    let setup_lifecycle = Arc::clone(&lifecycle);
    let mut builder = tauri::Builder::default().plugin(diagnostics::plugin());
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
                if lifecycle::should_show_on_second_instance(args) {
                    lifecycle::show_main_window(app);
                }
            }))
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }
    builder
        .manage(AppState::default())
        .manage(Arc::clone(&lifecycle))
        .plugin(tauri_plugin_dialog::init())
        .on_window_event(move |window, event| {
            if window.label() != "main" {
                return;
            }
            match event {
                tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                    window_state::remember(window.app_handle(), &window_lifecycle);
                }
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    window_state::remember(window.app_handle(), &window_lifecycle);
                    window_state::persist(window.app_handle(), &window_lifecycle);
                    if window_lifecycle.should_hide_on_close() {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                }
                _ => {}
            }
        })
        .setup(move |app| {
            if let Ok(log_dir) = app.path().app_log_dir() {
                let removed = diagnostics::prune_expired_logs(
                    &log_dir,
                    std::time::SystemTime::now(),
                    diagnostics::MAX_LOG_AGE,
                );
                log::info!(
                    "AppNook {} starting on {}: log retention {} days, {removed} expired files removed",
                    app.package_info().version,
                    std::env::consts::OS,
                    diagnostics::MAX_LOG_AGE.as_secs() / (24 * 60 * 60)
                );
            }
            let tray_ready = match lifecycle::setup_tray(app.handle(), Arc::clone(&tray_lifecycle))
            {
                Ok(()) => true,
                Err(error) => {
                    log::error!("Could not create the system tray: {error}");
                    false
                }
            };
            window_state::present_main_window(
                app.handle(),
                &setup_lifecycle,
                lifecycle::should_hide_on_autostart(starts_hidden_from_autostart, tray_ready),
            );
            lifecycle::start_background_initialization(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::catalog::get_apps,
            commands::catalog::refresh_apps,
            commands::catalog::force_full_scan,
            commands::catalog::reset_catalog_cache,
            commands::catalog::clear_icon_cache,
            commands::catalog::hydrate_visible_icons,
            commands::catalog::start_background_sync,
            commands::settings::cancel_scan,
            commands::launch::launch_app,
            commands::close::close_apps,
            commands::details::get_app_details,
            commands::details::open_app_folder,
            commands::uninstall::get_uninstall_preview,
            commands::uninstall::uninstall_app,
            commands::uninstall::get_uninstall_history,
            commands::uninstall::clear_uninstall_history,
            commands::settings::get_system_settings,
            commands::settings::set_scan_settings,
            commands::settings::set_close_behavior,
            commands::settings::save_preferences_backup,
            commands::links::open_telegram,
            commands::links::open_github,
            commands::links::open_apps_settings,
            commands::links::open_release,
            commands::links::stale_copy_status,
            commands::links::open_installed_copy,
            commands::diagnostics::log_client_error,
            commands::diagnostics::export_diagnostics_log
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
