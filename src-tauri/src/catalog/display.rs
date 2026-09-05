use super::{
    platform_kind, AppCategory, AppInfo, ArtifactKind, LaunchKind, PlatformKind, SourceKind,
    VisibilityClass, VisibilityReason,
};
use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CatalogAppDto {
    pub id: String,
    pub name: String,
    pub path: String,
    pub icon_base64: Option<String>,
    pub artifact_kind: ArtifactKind,
    pub category: AppCategory,
    pub launch_kind: LaunchKind,
    pub source_kind: SourceKind,
    pub platform_kind: Option<PlatformKind>,
    pub description: Option<String>,
    pub version: Option<String>,
    pub publisher: Option<String>,
    pub product_name: Option<String>,
    pub original_filename: Option<String>,
    pub install_location: Option<String>,
    pub can_uninstall: bool,
    pub canonical_identity: Option<String>,
    pub preference_identity: Option<String>,
    pub visibility_class: VisibilityClass,
    pub visibility_score: i16,
    pub visibility_reasons: Vec<VisibilityReason>,
    pub target_availability: Option<String>,
    pub category_reasons: Vec<String>,
    pub close_risk: Option<String>,
}

impl From<&AppInfo> for CatalogAppDto {
    fn from(app: &AppInfo) -> Self {
        Self {
            id: app.id.clone(),
            name: app.name.clone(),
            path: app.path.clone(),
            icon_base64: app.icon_base64.clone(),
            artifact_kind: app.artifact_kind,
            category: app.category,
            launch_kind: app.launch_kind,
            source_kind: app.source_kind,
            platform_kind: platform_kind::platform_kind(app),
            description: app.description.clone(),
            version: app.version.clone(),
            publisher: app.publisher.clone(),
            product_name: app.product_name.clone(),
            original_filename: app.original_filename.clone(),
            install_location: app.install_location.clone(),
            can_uninstall: app.can_uninstall,
            canonical_identity: app.canonical_identity.clone(),
            preference_identity: app.preference_identity.clone(),
            visibility_class: app.visibility_class,
            visibility_score: app.visibility_score,
            visibility_reasons: app.visibility_reasons.clone(),
            target_availability: app.target_availability.clone(),
            category_reasons: app.category_reasons.clone(),
            close_risk: app.close_risk.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::CatalogAppDto;
    use crate::app_state::cached_app;

    #[test]
    fn serializes_battle_net_platform_without_native_launch_fields() {
        let mut app = cached_app("World of Warcraft", r"C:\Menu\World of Warcraft.lnk");
        app.resolved_path = Some(r"D:\Games\Battle.net\World of Warcraft\Wow.exe".into());
        app.launch_arguments = Some("battlenet://WoW".into());

        let json = serde_json::to_value(CatalogAppDto::from(&app)).unwrap();

        assert_eq!(json["platformKind"], "battle_net");
        assert!(json.get("resolvedPath").is_none());
        assert!(json.get("launchArguments").is_none());
    }

    #[test]
    fn serializes_no_platform_for_an_ordinary_windows_app() {
        let app = cached_app("Notepad", r"C:\Windows\notepad.exe");

        let json = serde_json::to_value(CatalogAppDto::from(&app)).unwrap();

        assert!(json.get("platformKind").is_some());
        assert_eq!(json["platformKind"], serde_json::Value::Null);
    }
}
