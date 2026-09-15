use super::{processes_of, CloseOutcome, CloseTarget};

pub(super) fn outcome(
    targets: &[CloseTarget],
    matched: &[Vec<u32>],
    running: &[(u32, String)],
) -> CloseOutcome {
    let mut outcome = CloseOutcome::default();
    for (target, before) in targets.iter().zip(matched) {
        if before.is_empty() {
            outcome.not_running += 1;
        } else if processes_of(target, running).is_empty() {
            outcome.closed += 1;
        } else {
            outcome.failed += 1;
        }
    }
    outcome
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn refused_close_is_failed_and_finished_or_idle_targets_are_distinct() {
        let targets = ["Editor", "Player", "Idle"]
            .map(|name| CloseTarget::new(PathBuf::from(format!(r"C:\{name}\app.exe")), None));
        assert_eq!(
            outcome(
                &targets,
                &[vec![1], vec![2], vec![]],
                &[(1, r"C:\Editor\app.exe".into())]
            ),
            CloseOutcome {
                closed: 1,
                not_running: 1,
                failed: 1
            }
        );
    }

    #[test]
    fn reused_pid_for_another_target_is_not_a_survivor() {
        let target = CloseTarget::new(PathBuf::from(r"C:\Editor\app.exe"), None);
        assert_eq!(
            outcome(&[target], &[vec![1]], &[(1, r"C:\Other\app.exe".into())]).closed,
            1
        );
    }
}
