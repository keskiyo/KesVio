use crate::error::AppError;
use std::panic::{catch_unwind, AssertUnwindSafe};

pub(super) fn guarded<T>(
    what: &'static str,
    work: impl FnOnce() -> Result<T, AppError>,
) -> Result<T, AppError> {
    match catch_unwind(AssertUnwindSafe(work)) {
        Ok(result) => result,
        Err(_payload) => {
            log::error!("Scan contained a panic: work={what}");
            Err(AppError::ScanFailed)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_panicking_scan_body_returns_an_error_instead_of_unwinding() {
        crate::diagnostics::test_log::capture(|| {
            let result = guarded::<u32>("test scan", || panic!("private panic payload"));

            assert_eq!(result.unwrap_err(), AppError::ScanFailed);
            let lines = crate::diagnostics::test_log::lines().join("\n");
            assert!(lines.contains("Scan contained a panic: work=test scan"));
            assert!(!lines.contains("private panic payload"));
        });
    }

    #[test]
    fn a_completed_scan_body_passes_its_result_through_unchanged() {
        assert_eq!(guarded("test scan", || Ok(7)).unwrap(), 7);
        assert_eq!(
            guarded::<u32>("test scan", || Err(AppError::ScanCancelled)).unwrap_err(),
            AppError::ScanCancelled
        );
    }
}
