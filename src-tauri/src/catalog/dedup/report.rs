use super::family::{launcher_product_family, normalized_product_family};
use super::identity::resolved_canonical_id;
use super::merge::ResolverReport;
use super::resolve_apps;
use crate::catalog::AppInfo;
use serde::Serialize;
use std::collections::HashMap;

mod selection;

use selection::{report_member, winner_reason};

#[derive(Serialize)]
struct DedupMember {
    name: String,
    path: String,
    source: String,
    launch_arguments: Option<String>,
    candidate_score: u8,
}

#[derive(Serialize)]
struct DedupGroup {
    canonical_id: String,
    winner: DedupMember,
    winner_reason: String,
    members: Vec<DedupMember>,
    evidence: Vec<String>,
}

#[derive(Serialize)]
struct PossibleConfusion {
    family: String,
    entries: Vec<String>,
}

#[derive(Serialize)]
struct DedupReport {
    input: usize,
    output: usize,
    merged_groups: Vec<DedupGroup>,
    possible_confusions: Vec<PossibleConfusion>,
}

pub(crate) fn dev_report_enabled() -> bool {
    cfg!(debug_assertions)
}

pub(crate) fn write_dev_report(apps: &[AppInfo]) {
    if apps.len() < 30 {
        return;
    }
    let report = analyze(apps.to_vec());
    let Some(directory) = crate::paths::report_dir() else {
        return;
    };
    let path = directory.join("dedup-report.json");
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(&report) {
        let _ = std::fs::write(path, json);
    }
}

#[cfg(test)]
pub(in crate::catalog) fn resolved_groups(mut apps: Vec<AppInfo>) -> Vec<(String, Vec<String>)> {
    apps.sort_by_cached_key(super::canonical_order_key);
    let mut report = ResolverReport::default();
    let mut groups = resolve_apps(apps, &mut report)
        .iter()
        .map(|group| {
            let mut members = group
                .candidates
                .iter()
                .map(|candidate| candidate.app.path.clone())
                .collect::<Vec<_>>();
            members.sort();
            (resolved_canonical_id(group), members)
        })
        .collect::<Vec<_>>();
    groups.sort();
    groups
}

fn analyze(apps: Vec<AppInfo>) -> DedupReport {
    let input = apps.len();
    let mut report = ResolverReport::default();
    let resolved = resolve_apps(apps, &mut report);
    let output = resolved.len();
    let merged_groups = resolved
        .iter()
        .filter(|group| group.candidates.len() > 1)
        .map(|group| DedupGroup {
            canonical_id: resolved_canonical_id(group),
            winner: report_member(&group.app),
            winner_reason: winner_reason(group).into(),
            members: group
                .candidates
                .iter()
                .map(|candidate| report_member(&candidate.app))
                .collect(),
            evidence: group
                .evidence
                .iter()
                .map(|item| format!("{:?} ({})", item.reason, item.score))
                .collect(),
        })
        .collect();
    let mut by_family: HashMap<String, Vec<String>> = HashMap::new();
    for group in &resolved {
        let family =
            launcher_product_family(&normalized_product_family(&group.app.name)).to_string();
        by_family
            .entry(family)
            .or_default()
            .push(format!("{} [{}]", group.app.name, group.app.path));
    }
    let mut possible_confusions = by_family
        .into_iter()
        .filter(|(_, entries)| entries.len() > 1)
        .map(|(family, entries)| PossibleConfusion { family, entries })
        .collect::<Vec<_>>();
    possible_confusions.sort_by(|left, right| left.family.cmp(&right.family));
    DedupReport {
        input,
        output,
        merged_groups,
        possible_confusions,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog::{AppCategory, LaunchKind, SourceKind};

    fn shortcut(name: &str, path: &str, arguments: Option<&str>) -> AppInfo {
        AppInfo {
            id: String::new(),
            name: name.into(),
            path: path.into(),
            icon_base64: None,
            artifact_kind: Default::default(),
            category: AppCategory::Other,
            launch_kind: LaunchKind::Shortcut,
            source_kind: SourceKind::StartMenu,
            description: None,
            version: None,
            publisher: None,
            product_name: None,
            original_filename: None,
            install_location: None,
            can_uninstall: false,
            resolved_path: Some(r"C:\Program Files\SoftEther VPN Client\vpncmgr_x64.exe".into()),
            shortcut_icon_path: None,
            launch_arguments: arguments.map(str::to_owned),
            canonical_identity: None,
            preference_identity: None,
            visibility_class: Default::default(),
            visibility_score: 0,
            visibility_reasons: Vec::new(),
            target_availability: None,
            category_reasons: Vec::new(),
            close_risk: None,
            scan_folder: None,
            volume_id: None,
        }
    }

    #[test]
    fn report_explains_why_the_plain_shortcut_won() {
        let remote = shortcut(
            "Manage Remote Computer's SoftEther VPN Client",
            r"C:\Menu\Manage Remote.lnk",
            Some("/remote"),
        );
        let plain = shortcut(
            "SoftEther VPN Client Manager",
            r"C:\Menu\SoftEther VPN Client Manager.lnk",
            None,
        );
        let mut start_app = plain.clone();
        start_app.path = "Microsoft.AutoGenerated.{SOFTETHER}".into();
        start_app.launch_kind = LaunchKind::AppUserModelId;
        start_app.source_kind = SourceKind::StartApps;

        let report = analyze(vec![remote, plain, start_app]);
        let group = &report.merged_groups[0];

        assert_eq!(group.winner.name, "SoftEther VPN Client Manager");
        assert_eq!(group.winner.launch_arguments, None);
        assert_eq!(group.winner_reason, "plain_launch_without_arguments");
        assert!(group
            .members
            .iter()
            .any(|member| member.launch_arguments.as_deref() == Some("/remote")));
    }
}
