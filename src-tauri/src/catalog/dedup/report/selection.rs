use super::DedupMember;
use crate::catalog::dedup::candidate::candidate_score;
use crate::catalog::dedup::merge::ResolvedApp;
use crate::catalog::{AppInfo, SourceKind};

pub(super) fn report_member(app: &AppInfo) -> DedupMember {
    DedupMember {
        name: app.name.clone(),
        path: app.path.clone(),
        source: format!("{:?}", app.source_kind),
        launch_arguments: app.launch_arguments.clone(),
        candidate_score: candidate_score(app),
    }
}

pub(super) fn winner_reason(group: &ResolvedApp) -> &'static str {
    let winner = &group.app;
    let winner_score = candidate_score(winner);
    let winner_target = crate::catalog::dedup::normalize_path(
        winner
            .resolved_path
            .as_deref()
            .unwrap_or(winner.path.as_str()),
    );
    if winner.source_kind == SourceKind::Portable
        && group.candidates.iter().any(|candidate| {
            candidate.app.source_kind == SourceKind::Portable
                && candidate_score(&candidate.app) == winner_score
                && crate::catalog::dedup::family::version_key(candidate.app.version.as_deref())
                    < crate::catalog::dedup::family::version_key(winner.version.as_deref())
        })
    {
        return "newer_portable_version";
    }
    if !crate::catalog::dedup::family::is_32bit_variant(winner)
        && group.candidates.iter().any(|candidate| {
            candidate_score(&candidate.app) == winner_score
                && crate::catalog::dedup::family::is_32bit_variant(&candidate.app)
        })
    {
        return "64_bit_variant";
    }
    if winner.launch_arguments.is_none()
        && group.candidates.iter().any(|candidate| {
            candidate.app.launch_arguments.is_some()
                && candidate_score(&candidate.app) == winner_score
                && crate::catalog::dedup::normalize_path(
                    candidate
                        .app
                        .resolved_path
                        .as_deref()
                        .unwrap_or(candidate.app.path.as_str()),
                ) == winner_target
        })
    {
        return "plain_launch_without_arguments";
    }
    if group
        .candidates
        .iter()
        .any(|candidate| candidate_score(&candidate.app) < winner_score)
    {
        return "higher_candidate_score";
    }
    "canonical_order"
}
