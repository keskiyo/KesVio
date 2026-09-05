pub(super) mod installer_cache;
pub(super) mod portable;
mod portable_candidate;
pub(super) mod registry;
pub(crate) mod source;
pub(super) mod start_apps;
pub(super) mod steam;
mod steam_candidate;

pub(super) use portable_candidate::portable_app;
pub(super) use steam_candidate::steam_app;
