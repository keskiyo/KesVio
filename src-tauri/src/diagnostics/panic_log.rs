use std::backtrace::Backtrace;

pub(crate) fn install_panic_hook() {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let thread = std::thread::current().id();
        if let Some(location) = info.location() {
            log::error!("Rust panic: thread={thread:?} location={location}");
        } else {
            log::error!("Rust panic: thread={thread:?} location=unavailable");
        }
        log_backtrace(&Backtrace::force_capture().to_string());
        log::logger().flush();
        previous(info);
    }));
}

fn log_backtrace(backtrace: &str) {
    for line in backtrace.lines().take(128) {
        log::error!(
            "Panic backtrace: {}",
            line.chars().take(1024).collect::<String>()
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn panic_hook_records_location_and_stack_without_payload_and_preserves_previous_hook() {
        const CHILD: &str = "KESVIO_TEST_PANIC_HOOK_CHILD";
        if std::env::var_os(CHILD).is_some() {
            crate::diagnostics::test_log::capture(|| {
                std::panic::set_hook(Box::new(|_| log::info!("previous hook called")));
                install_panic_hook();
                let result = std::panic::catch_unwind(|| panic!("private test payload"));
                assert!(result.is_err());
                let lines = crate::diagnostics::test_log::lines().join("\n");
                assert!(lines.contains("Rust panic: thread="));
                assert!(lines.contains("panic_log.rs:"));
                assert!(lines.contains("Panic backtrace:"));
                assert!(lines.contains("previous hook called"));
                assert!(!lines.contains("private test payload"));
            });
            return;
        }
        let result = std::process::Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "diagnostics::panic_log::tests::panic_hook_records_location_and_stack_without_payload_and_preserves_previous_hook"])
            .env(CHILD, "1")
            .output()
            .unwrap();
        assert!(
            result.status.success(),
            "{} {}",
            String::from_utf8_lossy(&result.stdout),
            String::from_utf8_lossy(&result.stderr)
        );
    }

    #[test]
    fn backtrace_output_is_bounded_and_every_line_has_a_log_record() {
        crate::diagnostics::test_log::capture(|| {
            log_backtrace(&format!("{}\n", "x".repeat(2048)).repeat(200));
            let lines = crate::diagnostics::test_log::lines();
            assert_eq!(lines.len(), 128);
            assert!(lines
                .iter()
                .all(|line| line.starts_with("Panic backtrace: ") && line.len() == 1041));
        });
    }
}
