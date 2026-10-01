use std::time::{Duration, Instant};

pub(super) const LOG_EVERY: Duration = Duration::from_secs(1);
pub(super) const LOGGED_BURST: usize = 16;

#[derive(Default)]
pub(super) struct LogCadence {
    last: Option<(&'static str, Instant, usize)>,
    unlogged: usize,
}

impl LogCadence {
    pub(super) fn turn(&mut self, stage: &'static str, now: Instant) -> Option<usize> {
        let written = match self.last {
            Some((last_stage, at, written)) if last_stage == stage => {
                if written >= LOGGED_BURST && now.saturating_duration_since(at) < LOG_EVERY {
                    self.unlogged += 1;
                    return None;
                }
                written.saturating_add(1)
            }
            _ => {
                self.unlogged = 0;
                1
            }
        };
        self.last = Some((stage, now, written));
        Some(std::mem::take(&mut self.unlogged))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_short_stage_is_logged_step_by_step_so_a_killed_process_still_names_its_last_step() {
        let mut cadence = LogCadence::default();
        let start = Instant::now();

        for _ in 0..LOGGED_BURST {
            assert_eq!(cadence.turn("commit", start), Some(0));
        }
    }

    #[test]
    fn a_stage_that_keeps_running_logs_again_with_the_number_of_skipped_steps() {
        let mut cadence = LogCadence::default();
        let start = Instant::now();

        for _ in 0..LOGGED_BURST {
            assert_eq!(cadence.turn("installer-cache", start), Some(0));
        }
        assert_eq!(cadence.turn("installer-cache", start), None);
        assert_eq!(cadence.turn("installer-cache", start), None);
        assert_eq!(cadence.turn("installer-cache", start + LOG_EVERY), Some(2));
        assert_eq!(
            cadence.turn("portable", start + LOG_EVERY),
            Some(0),
            "a new stage is always logged at once"
        );
    }
}
