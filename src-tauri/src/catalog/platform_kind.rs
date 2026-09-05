use super::{AppInfo, PlatformKind, SourceKind};

const BATTLE_NET_SCHEME: &str = "battlenet://";

pub(super) fn platform_kind(app: &AppInfo) -> Option<PlatformKind> {
    platform_kind_with_metadata(
        app,
        app.product_name.as_deref(),
        app.publisher.as_deref(),
        app.install_location.as_deref(),
    )
}

pub(super) fn platform_kind_with_metadata(
    app: &AppInfo,
    product_name: Option<&str>,
    publisher: Option<&str>,
    install_location: Option<&str>,
) -> Option<PlatformKind> {
    if app.source_kind == SourceKind::Steam {
        return Some(PlatformKind::Steam);
    }
    if app.source_kind == SourceKind::Msix {
        return Some(PlatformKind::MicrosoftStore);
    }
    if is_steam_client(app, product_name, publisher) {
        return Some(PlatformKind::Steam);
    }
    if is_battle_net(app, product_name, publisher, install_location) {
        return Some(PlatformKind::BattleNet);
    }
    if app.source_kind == SourceKind::Portable {
        return Some(PlatformKind::Portable);
    }
    None
}

fn is_steam_client(app: &AppInfo, product_name: Option<&str>, publisher: Option<&str>) -> bool {
    let is_valve = publisher.is_some_and(|value| value.to_lowercase().contains("valve"));
    let has_steam_identity = app.name.eq_ignore_ascii_case("steam")
        || product_name.is_some_and(|value| value.eq_ignore_ascii_case("steam"))
        || app
            .original_filename
            .as_deref()
            .is_some_and(|value| value.eq_ignore_ascii_case("steam.exe"))
        || app.resolved_path.as_deref().is_some_and(|value| {
            value
                .replace('/', "\\")
                .to_lowercase()
                .ends_with(r"\steam.exe")
        });

    is_valve && has_steam_identity
}

fn is_battle_net(
    app: &AppInfo,
    product_name: Option<&str>,
    publisher: Option<&str>,
    install_location: Option<&str>,
) -> bool {
    battle_net_text(&app.name)
        || product_name.is_some_and(battle_net_text)
        || publisher.is_some_and(blizzard_publisher)
        || battle_net_path(&app.path)
        || app.resolved_path.as_deref().is_some_and(battle_net_path)
        || install_location.is_some_and(battle_net_path)
        || app.launch_arguments.as_deref().is_some_and(battle_net_uri)
}

fn battle_net_text(value: &str) -> bool {
    let folded = value.to_lowercase();
    folded.contains("battle.net") || folded.contains("battle net")
}

fn blizzard_publisher(value: &str) -> bool {
    value.to_lowercase().contains("blizzard")
}

fn battle_net_path(value: &str) -> bool {
    let folded = value.replace('/', "\\").to_lowercase();
    folded.contains("battle.net")
        || folded.contains(r"\blizzard\")
        || folded.contains(BATTLE_NET_SCHEME)
}

fn battle_net_uri(value: &str) -> bool {
    value.to_lowercase().contains(BATTLE_NET_SCHEME)
}

#[cfg(test)]
mod tests {
    use super::{platform_kind, platform_kind_with_metadata};
    use crate::app_state::cached_app;
    use crate::catalog::{PlatformKind, SourceKind};

    #[test]
    fn authoritative_sources_map_to_platforms() {
        let mut steam = cached_app("Portal 2", "steam://rungameid/620");
        steam.source_kind = SourceKind::Steam;
        let mut store = cached_app("Terminal", "Microsoft.Terminal!App");
        store.source_kind = SourceKind::Msix;
        let mut portable = cached_app("Editor", r"D:\Apps\Editor.exe");
        portable.source_kind = SourceKind::Portable;

        assert_eq!(platform_kind(&steam), Some(PlatformKind::Steam));
        assert_eq!(platform_kind(&store), Some(PlatformKind::MicrosoftStore));
        assert_eq!(platform_kind(&portable), Some(PlatformKind::Portable));
    }

    #[test]
    fn battle_net_evidence_overrides_portable_fallback() {
        let mut game = cached_app("Diablo IV", r"D:\Games\Battle.net\Diablo IV\game.exe");
        game.source_kind = SourceKind::Portable;

        assert_eq!(platform_kind(&game), Some(PlatformKind::BattleNet));
    }

    #[test]
    fn steam_client_from_start_menu_maps_to_steam() {
        let mut steam = cached_app(
            "Steam",
            r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Steam\Steam.lnk",
        );
        steam.source_kind = SourceKind::StartMenu;
        steam.publisher = Some("Valve Corporation".into());
        steam.product_name = Some("Steam".into());
        steam.original_filename = Some("steam.exe".into());
        steam.resolved_path = Some(r"C:\Program Files (x86)\Steam\Steam.exe".into());

        assert_eq!(platform_kind(&steam), Some(PlatformKind::Steam));
    }

    #[test]
    fn hydrated_metadata_promotes_a_portable_entry_to_battle_net() {
        let mut game = cached_app("Hearthstone", r"C:\Games\Hearthstone.exe");
        game.source_kind = SourceKind::Portable;

        assert_eq!(platform_kind(&game), Some(PlatformKind::Portable));
        assert_eq!(
            platform_kind_with_metadata(
                &game,
                Some("Hearthstone"),
                Some("Blizzard Entertainment"),
                Some(r"C:\Games"),
            ),
            Some(PlatformKind::BattleNet)
        );
    }

    #[test]
    fn battle_net_native_evidence_is_detected() {
        let mut uri_game = cached_app("World of Warcraft", r"C:\Menu\World of Warcraft.lnk");
        uri_game.launch_arguments = Some("battlenet://WoW".into());
        let mut published_game = cached_app("Hearthstone", r"C:\Games\Hearthstone.exe");
        published_game.publisher = Some("Blizzard Entertainment".into());
        let installed_game = cached_app("StarCraft", r"C:\Blizzard\StarCraft\StarCraft.exe");

        assert_eq!(platform_kind(&uri_game), Some(PlatformKind::BattleNet));
        assert_eq!(
            platform_kind(&published_game),
            Some(PlatformKind::BattleNet)
        );
        assert_eq!(
            platform_kind(&installed_game),
            Some(PlatformKind::BattleNet)
        );
    }

    #[test]
    fn ordinary_windows_and_generic_battle_names_have_no_platform() {
        let notepad = cached_app("Notepad", r"C:\Windows\notepad.exe");
        let battle_chess = cached_app("Battle Chess", r"C:\Games\BattleChess.exe");

        assert_eq!(platform_kind(&notepad), None);
        assert_eq!(platform_kind(&battle_chess), None);
    }
}
