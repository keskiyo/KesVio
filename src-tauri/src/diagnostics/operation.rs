use std::time::Instant;

pub(crate) struct Operation {
    name: &'static str,
    started: Instant,
}

impl Operation {
    pub(crate) fn start(name: &'static str) -> Self {
        log::info!(
            "Operation starting: {name} thread={:?}",
            std::thread::current().id()
        );
        Self {
            name,
            started: Instant::now(),
        }
    }
}

impl Drop for Operation {
    fn drop(&mut self) {
        let elapsed = self.started.elapsed().as_millis();
        let thread = std::thread::current().id();
        if std::thread::panicking() {
            log::error!(
                "Operation panicked: {} elapsedMs={elapsed} thread={thread:?}",
                self.name
            );
            log::logger().flush();
        } else {
            log::info!(
                "Operation returned: {} elapsedMs={elapsed} thread={thread:?}",
                self.name
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normal_return_and_unwind_produce_different_terminal_records() {
        crate::diagnostics::test_log::capture(|| {
            let operation = Operation::start("normal");
            assert!(crate::diagnostics::test_log::lines()
                .iter()
                .any(|line| line.contains("Operation starting: normal")));
            drop(operation);
            let result = std::panic::catch_unwind(|| {
                let _operation = Operation::start("unwind");
                panic!("test payload must not be logged");
            });
            assert!(result.is_err());
            let lines = crate::diagnostics::test_log::lines().join("\n");
            assert!(lines.contains("Operation returned: normal"));
            assert!(lines.contains("Operation panicked: unwind"));
            assert!(!lines.contains("Operation returned: unwind"));
            assert!(!lines.contains("test payload"));
        });
    }
}
