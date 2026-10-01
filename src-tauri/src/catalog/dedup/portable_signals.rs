use super::candidate::AppCandidate;
use super::signals::{normalized_version_string, shared};
use crate::catalog::SourceKind;
use std::path::Path;

pub(super) fn versioned_portable_copy(left: &AppCandidate, right: &AppCandidate) -> bool {
    left.app.source_kind == SourceKind::Portable
        && right.app.source_kind == SourceKind::Portable
        && left.family == right.family
        && (left.app.version.is_some() || right.app.version.is_some())
}

pub(super) fn same_version_portable_copy(left: &AppCandidate, right: &AppCandidate) -> bool {
    (left.app.source_kind == SourceKind::Portable || right.app.source_kind == SourceKind::Portable)
        && left.family == right.family
        && matches!(
            (
                normalized_version_string(&left.app),
                normalized_version_string(&right.app)
            ),
            (Some(left), Some(right)) if left == right
        )
}

pub(super) fn both_unversioned_portable_copies(left: &AppCandidate, right: &AppCandidate) -> bool {
    left.app.source_kind == SourceKind::Portable
        && right.app.source_kind == SourceKind::Portable
        && left.family == right.family
        && left.app.version.is_none()
        && right.app.version.is_none()
}

pub(super) fn distinct_portable_launchers(left: &AppCandidate, right: &AppCandidate) -> bool {
    if left.app.source_kind != SourceKind::Portable || right.app.source_kind != SourceKind::Portable
    {
        return false;
    }
    let left = portable_launcher_stem(&left.app.path);
    let right = portable_launcher_stem(&right.app.path);
    !left.is_empty() && !right.is_empty() && left != right
}

fn portable_launcher_stem(path: &str) -> String {
    let Some(stem) = Path::new(path).file_stem() else {
        return String::new();
    };
    let mut parts = stem
        .to_string_lossy()
        .to_lowercase()
        .split(|character: char| !character.is_alphanumeric())
        .filter(|part| !part.is_empty())
        .map(str::to_owned)
        .collect::<Vec<_>>();
    while parts.last().is_some_and(|part| {
        matches!(
            part.as_str(),
            "all" | "x32" | "x64" | "x86" | "amd64" | "win32" | "win64" | "32" | "64"
        )
    }) {
        parts.pop();
    }
    parts.join(" ")
}

pub(super) fn same_portable_root(left: &AppCandidate, right: &AppCandidate) -> bool {
    shared(
        left.identity.install_root.as_ref(),
        right.identity.install_root.as_ref(),
    )
}
