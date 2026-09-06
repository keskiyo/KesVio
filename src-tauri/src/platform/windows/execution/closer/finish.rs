use super::identity::{is_instance_of, CloseTarget};
use super::processes::{image_path_of, running_images, terminate_matching};
use super::{processes_of, CloseOutcome};

const TERMINATION_RECHECKS: usize = 4;
const TERMINATION_RECHECK_DELAY_MS: u64 = 250;

pub(super) fn finish(targets: &[CloseTarget], matched: &[Vec<u32>]) -> CloseOutcome {
    let running = running_images();
    finish_with(targets, matched, &running, terminate, is_gone)
}

fn terminate(pid: u32, target: &CloseTarget) -> bool {
    terminate_matching(pid, |image| is_instance_of(image, target))
}

fn is_gone(pid: u32, target: &CloseTarget) -> bool {
    image_path_of(pid).is_none_or(|image| !is_instance_of(&image, target))
}

fn finish_with(
    targets: &[CloseTarget],
    matched: &[Vec<u32>],
    running: &[(u32, String)],
    terminate_process: impl FnMut(u32, &CloseTarget) -> bool,
    process_is_gone: impl FnMut(u32, &CloseTarget) -> bool,
) -> CloseOutcome {
    finish_with_pause(
        targets,
        matched,
        running,
        terminate_process,
        process_is_gone,
        || {
            std::thread::sleep(std::time::Duration::from_millis(
                TERMINATION_RECHECK_DELAY_MS,
            ))
        },
    )
}

fn finish_with_pause(
    targets: &[CloseTarget],
    matched: &[Vec<u32>],
    running: &[(u32, String)],
    mut terminate_process: impl FnMut(u32, &CloseTarget) -> bool,
    mut process_is_gone: impl FnMut(u32, &CloseTarget) -> bool,
    mut pause: impl FnMut(),
) -> CloseOutcome {
    let survivors: Vec<Vec<u32>> = targets
        .iter()
        .map(|target| processes_of(target, running))
        .collect();
    for (target, pids) in targets.iter().zip(&survivors) {
        for pid in pids {
            terminate_process(*pid, target);
        }
    }
    let mut gone: Vec<Vec<bool>> = survivors
        .iter()
        .map(|pids| vec![pids.is_empty(); pids.len()])
        .collect();
    for attempt in 0..=TERMINATION_RECHECKS {
        for ((target, pids), states) in targets.iter().zip(&survivors).zip(&mut gone) {
            for (pid, state) in pids.iter().zip(states) {
                if !*state {
                    *state = process_is_gone(*pid, target);
                }
            }
        }
        if gone.iter().flatten().all(|state| *state) {
            break;
        }
        if attempt < TERMINATION_RECHECKS {
            pause();
        }
    }
    let mut outcome = CloseOutcome::default();
    for ((before, survivors), gone) in matched.iter().zip(&survivors).zip(&gone) {
        if before.is_empty() {
            outcome.not_running += 1;
        } else if survivors.iter().zip(gone).all(|(_, state)| *state) {
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
    use std::cell::{Cell, RefCell};
    use std::path::{Path, PathBuf};
    use std::time::{Duration, Instant};

    fn target(executable: &str) -> CloseTarget {
        let path = PathBuf::from(executable);
        let root = path.parent().map(Path::to_path_buf);
        CloseTarget::new(path, root)
    }

    #[test]
    fn counts_a_target_with_no_processes_as_idle() {
        let outcome = finish(&[target(r"C:\Editor\editor.exe")], &[Vec::new()]);

        assert_eq!(
            outcome,
            CloseOutcome {
                closed: 0,
                not_running: 1,
                failed: 0,
            }
        );
    }

    #[test]
    fn counts_a_target_whose_processes_are_gone_as_closed() {
        let outcome = finish(&[target(r"C:\Nowhere\gone.exe")], &[vec![u32::MAX]]);

        assert_eq!(
            outcome,
            CloseOutcome {
                closed: 1,
                not_running: 0,
                failed: 0,
            }
        );
    }

    #[test]
    fn reports_a_process_that_survives_termination_as_failed() {
        let outcome = finish_with(
            &[target(r"C:\\Editor\\editor.exe")],
            &[vec![10]],
            &[(10, r"C:\\Editor\\editor.exe".to_string())],
            |_, _| false,
            |_, _| false,
        );

        assert_eq!(outcome.failed, 1);
        assert_eq!(outcome.closed, 0);
    }

    #[test]
    fn rechecks_all_survivors_in_one_bounded_window() {
        let targets = [
            target(r"C:\Editor\editor.exe"),
            target(r"C:\Browser\browser.exe"),
        ];
        let matched = [vec![10], vec![20]];
        let running = [
            (10, r"C:\Editor\editor.exe".to_string()),
            (20, r"C:\Browser\browser.exe".to_string()),
        ];

        let started_at = Instant::now();
        let outcome = finish_with(&targets, &matched, &running, |_, _| false, |_, _| false);

        assert_eq!(outcome.failed, 2);
        assert!(started_at.elapsed() < Duration::from_millis(1500));
    }

    #[test]
    fn confirms_a_process_that_exits_after_the_first_probe() {
        let probes = Cell::new(0);

        let outcome = finish_with_pause(
            &[target(r"C:\Editor\editor.exe")],
            &[vec![10]],
            &[(10, r"C:\Editor\editor.exe".to_string())],
            |_, _| false,
            |_, _| {
                probes.set(probes.get() + 1);
                probes.get() > 1
            },
            || {},
        );

        assert_eq!(outcome.closed, 1);
    }

    #[test]
    fn terminates_each_pid_against_the_target_it_was_matched_against() {
        let targets = [
            target(r"C:\Editor\editor.exe"),
            target(r"C:\Browser\browser.exe"),
        ];
        let running = [
            (10, r"C:\Editor\editor.exe".to_string()),
            (20, r"C:\Browser\browser.exe".to_string()),
        ];
        let requests = RefCell::new(Vec::new());

        finish_with(
            &targets,
            &[vec![10], vec![20]],
            &running,
            |pid, requested| {
                requests
                    .borrow_mut()
                    .push((pid, requested.executable.clone()));
                true
            },
            |_, _| true,
        );

        assert_eq!(
            requests.into_inner(),
            vec![
                (10, PathBuf::from(r"C:\Editor\editor.exe")),
                (20, PathBuf::from(r"C:\Browser\browser.exe")),
            ]
        );
    }
}
