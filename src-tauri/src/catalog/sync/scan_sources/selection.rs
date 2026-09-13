use crate::catalog::sync::{SyncRequest, WatchScope};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) struct ScanSelection {
    pub registry: bool,
    pub start_menu: bool,
    pub start_apps: bool,
    pub installer: bool,
    pub steam: bool,
    pub portable: bool,
}

impl ScanSelection {
    pub(super) fn for_request(request: SyncRequest) -> Self {
        let SyncRequest::Watch(scope) = request else {
            return Self::all();
        };
        if scope == WatchScope::ALL {
            return Self::all();
        }
        Self {
            registry: true,
            start_menu: scope.contains(WatchScope::START_MENU),
            start_apps: scope.contains(WatchScope::REGISTRY),
            installer: scope.contains(WatchScope::REGISTRY),
            steam: false,
            portable: scope.contains(WatchScope::PORTABLE),
        }
    }

    pub(super) const fn all() -> Self {
        Self {
            registry: true,
            start_menu: true,
            start_apps: true,
            installer: true,
            steam: true,
            portable: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_events_scan_registration_sources_and_installer_caches() {
        assert_eq!(
            ScanSelection::for_request(SyncRequest::Watch(WatchScope::REGISTRY)),
            ScanSelection {
                registry: true,
                start_menu: false,
                start_apps: true,
                installer: true,
                steam: false,
                portable: false,
            }
        );
    }

    #[test]
    fn start_menu_events_keep_registry_metadata_without_other_walks() {
        let selected = ScanSelection::for_request(SyncRequest::Watch(WatchScope::START_MENU));

        assert!(selected.registry && selected.start_menu);
        assert!(!selected.start_apps);
        assert!(!selected.installer);
        assert!(!selected.steam);
        assert!(!selected.portable);
    }

    #[test]
    fn portable_events_reuse_steam_apps() {
        let selected = ScanSelection::for_request(SyncRequest::Watch(WatchScope::PORTABLE));

        assert!(selected.registry && selected.portable);
        assert!(!selected.start_menu);
        assert!(!selected.start_apps);
        assert!(!selected.installer);
        assert!(!selected.steam);
    }

    #[test]
    fn non_watch_requests_keep_full_source_coverage() {
        for request in [
            SyncRequest::Startup,
            SyncRequest::Refresh,
            SyncRequest::Force,
        ] {
            assert_eq!(ScanSelection::for_request(request), ScanSelection::all());
        }
    }
}
