use super::*;
use windows::Win32::Foundation::ERROR_ACCESS_DENIED;

#[test]
fn files_on_disk_offer_elevation_and_protocol_links_do_not() {
    assert!(supports_elevated_launch(
        LaunchKind::Executable,
        r"C:\Tools\tool.exe"
    ));
    assert!(supports_elevated_launch(
        LaunchKind::Shortcut,
        r"C:\Menu\Tool.lnk"
    ));
    assert!(!supports_elevated_launch(
        LaunchKind::Executable,
        "steam://rungameid/1"
    ));
}

#[test]
fn an_app_id_the_shell_does_not_know_offers_no_elevation() {
    assert!(!supports_elevated_launch(
        LaunchKind::AppUserModelId,
        "KesVio.Test.Missing_0000000000000!App"
    ));
}

#[test]
fn a_shell_item_without_a_runas_verb_is_unsupported() {
    let missing = windows::core::Error::from(ERROR_NO_ASSOCIATION.to_hresult());
    assert!(matches!(
        elevated_failure(missing),
        ElevatedLaunchError::Unsupported
    ));
}

#[test]
fn a_dismissed_consent_prompt_is_a_cancellation() {
    let cancelled = windows::core::Error::from(ERROR_CANCELLED.to_hresult());
    assert!(matches!(
        elevated_failure(cancelled),
        ElevatedLaunchError::Cancelled
    ));
}

#[test]
fn any_other_shell_failure_stays_a_failure() {
    let denied = windows::core::Error::from(ERROR_ACCESS_DENIED.to_hresult());
    assert!(matches!(
        elevated_failure(denied),
        ElevatedLaunchError::Failed(_)
    ));
}

#[test]
fn unsupported_targets_are_refused_before_the_shell_is_called() {
    assert!(matches!(
        launch_elevated(LaunchKind::Executable, "steam://rungameid/1", None),
        Err(ElevatedLaunchError::Unsupported)
    ));
}

#[test]
fn steam_targets_are_recognized_as_protocol_uris() {
    assert!(is_launch_uri("steam://rungameid/2183900"));
    assert!(is_launch_uri("  STEAM://rungameid/1  "));
}

#[test]
fn ordinary_targets_are_not_treated_as_protocol_uris() {
    for target in [
        r"C:\Games\game.exe",
        r"C:\Menu\Game.lnk",
        r"\\server\share\game.exe",
        "Microsoft.WindowsCamera_8wekyb3d8bbwe!App",
        "https://example.invalid",
        "",
    ] {
        assert!(!is_launch_uri(target), "{target}");
    }
}

#[test]
fn an_executable_starts_in_its_own_directory() {
    assert_eq!(
        working_directory(LaunchKind::Executable, r"D:\Tools\rufus-4.11p.exe").as_deref(),
        Some(r"D:\Tools")
    );
    assert_eq!(
        working_directory(LaunchKind::Executable, r"C:\Program Files\App\app.exe").as_deref(),
        Some(r"C:\Program Files\App")
    );
}

#[test]
fn targets_without_a_directory_of_their_own_keep_none() {
    for (kind, target) in [
        (LaunchKind::Shortcut, r"C:\Menu\Editor.lnk"),
        (LaunchKind::AppUserModelId, "Contoso.App_abc!App"),
        (LaunchKind::Executable, "steam://rungameid/2183900"),
        (LaunchKind::Executable, "app.exe"),
    ] {
        assert_eq!(working_directory(kind, target), None, "{target}");
    }
}

#[test]
fn builds_apps_folder_target() {
    assert_eq!(
        apps_folder_target("OpenAI.Codex_abc!App"),
        r"shell:AppsFolder\OpenAI.Codex_abc!App"
    );
}

#[test]
fn keeps_arguments_for_executables() {
    assert_eq!(
        parameters_for(
            LaunchKind::Executable,
            r"C:\Editor.exe",
            Some(" --safe-mode ")
        ),
        Some("--safe-mode")
    );
}

#[test]
fn never_adds_parameters_to_shortcuts_aumids_or_uris() {
    assert_eq!(
        parameters_for(
            LaunchKind::Shortcut,
            r"C:\Menu\Editor.lnk",
            Some("--safe-mode")
        ),
        None
    );
    assert_eq!(
        parameters_for(
            LaunchKind::AppUserModelId,
            "Contoso.App!App",
            Some("--safe-mode")
        ),
        None
    );
    assert_eq!(
        parameters_for(
            LaunchKind::Executable,
            "steam://rungameid/1",
            Some("--safe-mode")
        ),
        None
    );
}
