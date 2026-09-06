mod finish;
mod frames;
mod identity;
mod processes;

pub(crate) use identity::CloseTarget;

use finish::finish;
use identity::is_instance_of;
use processes::running_images;
use std::collections::HashSet;

const GRACE_SECONDS: u64 = 5;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum CloseStage {
    Asking { running: usize },
    Waiting { seconds_left: u64 },
    Terminating,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub(crate) struct CloseOutcome {
    pub(crate) closed: usize,
    pub(crate) not_running: usize,
    pub(crate) failed: usize,
}

fn processes_of(target: &CloseTarget, running: &[(u32, String)]) -> Vec<u32> {
    running
        .iter()
        .filter(|(_, image)| is_instance_of(image, target))
        .map(|(pid, _)| *pid)
        .collect()
}

pub(crate) fn close_processes(
    targets: &[CloseTarget],
    progress: impl Fn(CloseStage),
) -> CloseOutcome {
    if targets.is_empty() {
        return CloseOutcome::default();
    }
    let running = running_images();
    let matched: Vec<Vec<u32>> = targets
        .iter()
        .map(|target| processes_of(target, &running))
        .collect();
    let live: HashSet<u32> = matched.iter().flatten().copied().collect();
    if live.is_empty() {
        return CloseOutcome {
            closed: 0,
            not_running: targets.len(),
            failed: 0,
        };
    }
    progress(CloseStage::Asking {
        running: matched.iter().filter(|pids| !pids.is_empty()).count(),
    });
    for window in frames::windows_of(live) {
        frames::ask_to_close(window);
    }
    for seconds_left in (1..=GRACE_SECONDS).rev() {
        progress(CloseStage::Waiting { seconds_left });
        std::thread::sleep(std::time::Duration::from_secs(1));
    }
    progress(CloseStage::Terminating);
    finish(targets, &matched)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;
    use std::path::{Path, PathBuf};

    fn target(executable: &str) -> CloseTarget {
        let path = PathBuf::from(executable);
        let root = path.parent().map(Path::to_path_buf);
        CloseTarget::new(path, root)
    }

    #[test]
    fn reports_nothing_for_an_empty_request() {
        assert_eq!(close_processes(&[], |_| {}), CloseOutcome::default());
    }

    // Nothing is running, so nothing is asked, waited for or terminated: a scenario that closes
    // idle applications must not show the user a five second countdown over no work.
    #[test]
    fn an_idle_target_reports_no_stages() {
        let stages = Cell::new(0);

        close_processes(
            &[target(r"C:\Nowhere\this-executable-does-not-exist.exe")],
            |_| stages.set(stages.get() + 1),
        );

        assert_eq!(stages.get(), 0);
    }

    #[test]
    fn reports_targets_that_are_not_running() {
        let outcome = close_processes(
            &[
                target(r"C:\Nowhere\this-executable-does-not-exist.exe"),
                target(r"C:\Nowhere\neither-does-this-one.exe"),
            ],
            |_| {},
        );

        assert_eq!(
            outcome,
            CloseOutcome {
                closed: 0,
                not_running: 2,
                failed: 0,
            }
        );
    }

    #[test]
    fn selects_all_processes_in_the_requested_installation_root() {
        let running = vec![
            (10, r"C:\Apps\Editor\editor.exe".to_string()),
            (11, r"c:\apps\editor\EDITOR.EXE".to_string()),
            (12, r"C:\Apps\Editor\updater.exe".to_string()),
        ];

        assert_eq!(
            processes_of(&target(r"C:\Apps\Editor\editor.exe"), &running),
            vec![10, 11, 12]
        );
    }

    #[test]
    fn selects_launcher_replacements_in_the_same_installation_root() {
        let running = vec![
            (10, r"D:\Games\Battle.net\Battle.net.exe".to_string()),
            (11, r"D:\Games\Battle.net\Agent.exe".to_string()),
            (12, r"D:\Games\Other\Battle.net.exe".to_string()),
        ];

        assert_eq!(
            processes_of(
                &target(r"D:\Games\Battle.net\Battle.net Launcher.exe"),
                &running
            ),
            vec![10, 11]
        );
    }

    #[test]
    fn selects_the_processes_of_an_application_that_updated_itself() {
        let chat = CloseTarget::new(
            PathBuf::from(r"C:\Program Files\WindowsApps\Vendor.App_1.0.0.0_x64__abc\app\Chat.exe"),
            Some(PathBuf::from(
                r"C:\Program Files\WindowsApps\Vendor.App_1.0.0.0_x64__abc",
            )),
        );
        let running = vec![
            (
                20,
                r"C:\Program Files\WindowsApps\Vendor.App_2.5.9.0_x64__abc\app\Chat.exe"
                    .to_string(),
            ),
            (
                21,
                r"C:\Program Files\WindowsApps\Other.App_2.5.9.0_x64__zzz\app\Chat.exe".to_string(),
            ),
        ];

        assert_eq!(processes_of(&chat, &running), vec![20]);
    }
}
