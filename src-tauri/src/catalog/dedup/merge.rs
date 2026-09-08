use super::candidate::candidate_score;
use super::candidate::AppCandidate;
use super::evidence::score_evidence;
use super::evidence::Evidence;
use super::family::{is_32bit_variant, version_key};
use super::target::location_holds_target;
use crate::catalog::{AppCategory, AppInfo, ArtifactKind, SourceKind};

#[derive(Clone, Debug)]
pub(super) struct ResolvedApp {
    pub(super) app: AppInfo,
    pub(super) candidates: Vec<AppCandidate>,
    pub(super) evidence: Vec<Evidence>,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub(super) struct ResolverReport {
    pub candidates: usize,
    pub merged: usize,
    pub evidence: Vec<Evidence>,
    pub possible_duplicates: usize,
}

pub(super) fn merge_resolved(
    existing: &mut ResolvedApp,
    candidate: AppCandidate,
    report: &mut ResolverReport,
) {
    let (evidence, _score) = existing
        .candidates
        .iter()
        .map(|left| score_evidence(left, &candidate))
        .max_by_key(|(_, score)| *score)
        .unwrap_or_default();
    report.merged += 1;
    report.evidence.extend(evidence.iter().cloned());
    existing.evidence.extend(evidence);
    existing.app = merge_app(existing.app.clone(), candidate.app.clone());
    existing.candidates.push(candidate);
}

pub(super) fn merge_app(left: AppInfo, right: AppInfo) -> AppInfo {
    let scores_tie = candidate_score(&right) == candidate_score(&left);
    let prefer_right = candidate_score(&right) > candidate_score(&left)
        || (scores_tie
            && left.source_kind == SourceKind::Portable
            && right.source_kind == SourceKind::Portable
            && version_key(right.version.as_deref()) > version_key(left.version.as_deref()))
        || (scores_tie && is_32bit_variant(&left) && !is_32bit_variant(&right));
    let (mut primary, secondary) = if prefer_right {
        (right, left)
    } else {
        (left, right)
    };
    let secondary_is_side_action = is_side_action(&secondary.visibility_reasons)
        || super::target::is_squirrel_stub(&secondary);
    let same_target = describes_same_target(&primary, &secondary);
    if primary.description.is_none() {
        primary.description = secondary.description;
    }
    if primary.version.is_none() {
        primary.version = secondary.version;
    }
    if (primary.publisher.is_none()
        || primary
            .publisher
            .as_deref()
            .is_some_and(|value| value.starts_with("CN=")))
        && secondary
            .publisher
            .as_deref()
            .is_some_and(|value| !value.starts_with("CN="))
    {
        primary.publisher = secondary.publisher;
    }
    if primary.product_name.is_none() {
        primary.product_name = secondary.product_name;
    }
    if primary.original_filename.is_none() {
        primary.original_filename = secondary.original_filename;
    }
    if artifact_rank(secondary.artifact_kind) > artifact_rank(primary.artifact_kind) {
        primary.artifact_kind = secondary.artifact_kind;
    }
    if primary.artifact_kind != ArtifactKind::Application {
        primary.category = AppCategory::InstallersDocs;
    }
    if primary.install_location.is_none() {
        let adopted = secondary
            .install_location
            .filter(|location| location_holds_target(location, &primary));
        primary.install_location = adopted;
    }
    if primary.icon_base64.is_none() {
        primary.icon_base64 = secondary.icon_base64;
    }
    if primary.resolved_path.is_none() {
        primary.resolved_path = secondary.resolved_path;
    }
    if primary.shortcut_icon_path.is_none() {
        primary.shortcut_icon_path = secondary.shortcut_icon_path;
    }
    if primary.launch_arguments.is_none() && !secondary_is_side_action {
        primary.launch_arguments = secondary.launch_arguments;
    }
    if visibility_rank(secondary.visibility_class) > visibility_rank(primary.visibility_class) {
        primary.visibility_class = secondary.visibility_class;
    }
    primary.visibility_score = primary.visibility_score.max(secondary.visibility_score);
    for reason in secondary.visibility_reasons {
        let survives_merge = crate::catalog::visibility::is_sticky_auxiliary(&reason)
            || reason == crate::catalog::VisibilityReason::ConsoleApplication;
        if survives_merge && same_target && !primary.visibility_reasons.contains(&reason) {
            primary.visibility_reasons.push(reason);
        }
    }
    let card_is_sticky = primary
        .visibility_reasons
        .iter()
        .any(crate::catalog::visibility::is_sticky_auxiliary);
    if primary.visibility_class == crate::catalog::VisibilityClass::Primary && card_is_sticky {
        primary.visibility_class = crate::catalog::VisibilityClass::Auxiliary;
    }
    primary.can_uninstall |= secondary.can_uninstall;
    primary
}

fn describes_same_target(left: &AppInfo, right: &AppInfo) -> bool {
    fn target(app: &AppInfo) -> String {
        crate::catalog::place::normalized_path(
            app.resolved_path.as_deref().unwrap_or(app.path.as_str()),
        )
    }
    let left = target(left);
    !left.is_empty() && left == target(right)
}

fn artifact_rank(kind: ArtifactKind) -> u8 {
    match kind {
        ArtifactKind::Application => 0,
        ArtifactKind::Documentation => 1,
        ArtifactKind::Installer => 2,
    }
}

fn is_side_action(reasons: &[crate::catalog::VisibilityReason]) -> bool {
    use crate::catalog::VisibilityReason::{DocumentationShortcut, MaintenanceExecutable};
    reasons
        .iter()
        .any(|reason| matches!(reason, MaintenanceExecutable | DocumentationShortcut))
}

fn visibility_rank(class: crate::catalog::VisibilityClass) -> u8 {
    match class {
        crate::catalog::VisibilityClass::Rejected => 0,
        crate::catalog::VisibilityClass::Auxiliary => 1,
        crate::catalog::VisibilityClass::Primary => 2,
    }
}

#[cfg(test)]
mod tests;
