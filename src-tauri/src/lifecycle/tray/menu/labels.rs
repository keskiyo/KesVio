use super::super::model::{TrayFavorite, TrayScenario};

pub(super) const MAX_LABEL_CHARS: usize = 40;
pub(super) const FALLBACK_LABEL: &str = "Scenario";
pub(super) const FAVORITE_MARK: &str = "★ ";
pub(super) const PLAIN_MARK: &str = "☆ ";

pub(in crate::lifecycle::tray) fn sanitize_label(name: &str) -> String {
    let collapsed = name
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .filter(|character| !character.is_control())
        .collect::<String>();
    let trimmed = if collapsed.chars().count() > MAX_LABEL_CHARS {
        let kept = collapsed
            .chars()
            .take(MAX_LABEL_CHARS - 1)
            .collect::<String>();
        format!("{}…", kept.trim_end())
    } else {
        collapsed
    };
    if trimmed.is_empty() {
        return FALLBACK_LABEL.to_owned();
    }
    trimmed.replace('&', "&&")
}

pub(super) fn menu_label(scenario: &TrayScenario, marked: bool) -> String {
    let label = sanitize_label(&scenario.label);
    if !marked {
        return label;
    }
    let mark = if scenario.favorite {
        FAVORITE_MARK
    } else {
        PLAIN_MARK
    };
    format!("{mark}{label}")
}

pub(super) fn favorite_labels(favorites: &[TrayFavorite]) -> Vec<String> {
    let labels = favorites
        .iter()
        .map(|favorite| sanitize_label(&favorite.label))
        .collect::<Vec<_>>();
    labels
        .iter()
        .enumerate()
        .map(|(index, label)| {
            let duplicates = labels.iter().filter(|other| *other == label).count();
            if duplicates == 1 {
                return label.clone();
            }
            let position = labels[..index]
                .iter()
                .filter(|other| *other == label)
                .count()
                + 1;
            format!("{label} ({position})")
        })
        .collect()
}
