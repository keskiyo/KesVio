use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::System::Threading::WaitForInputIdle;
use windows::Win32::UI::Shell::{
    ShellExecuteExW, ShellExecuteW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW,
};
use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

pub(crate) struct OwnedProcessHandle(isize);

impl Drop for OwnedProcessHandle {
    fn drop(&mut self) {
        // SAFETY: `CloseHandle` requires a handle this process owns and has not already closed.
        // The only constructor is `shell_execute_verb`, which stores the process handle
        // `ShellExecuteExW` returned under `SEE_MASK_NOCLOSEPROCESS` — ownership transferred to
        // us — and only after `is_invalid()` ruled out the null case. The field is private and
        // never copied out, so this is the single close, and `Drop` runs once.
        let _ = unsafe { CloseHandle(HANDLE(self.0 as *mut core::ffi::c_void)) };
    }
}

pub(crate) fn wait_for_input_idle(handle: &OwnedProcessHandle, timeout_ms: u32) {
    let handle = HANDLE(handle.0 as *mut core::ffi::c_void);
    // SAFETY: the handle is borrowed from a live `OwnedProcessHandle`, so it is still open for
    // the whole call — `Drop` cannot run while the borrow is held. `WaitForInputIdle` only reads
    // the handle; a process without a message queue or an elapsed timeout is reported through the
    // return value, which the caller deliberately ignores in favour of its own ceiling timer.
    unsafe { WaitForInputIdle(handle, timeout_ms) };
}

fn wide(value: &str) -> Vec<u16> {
    OsStr::new(value).encode_wide().chain(Some(0)).collect()
}

pub(super) fn shell_execute_verb(
    verb: &str,
    target: &str,
    parameters: Option<&str>,
    directory: Option<&str>,
) -> windows::core::Result<Option<OwnedProcessHandle>> {
    let operation = wide(verb);
    let file = wide(target);
    let parameters = parameters.map(wide);
    let directory = directory.map(wide);
    let mut info = SHELLEXECUTEINFOW {
        cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
        fMask: SEE_MASK_NOCLOSEPROCESS,
        lpVerb: PCWSTR(operation.as_ptr()),
        lpFile: PCWSTR(file.as_ptr()),
        lpParameters: parameters
            .as_ref()
            .map_or(PCWSTR::null(), |value| PCWSTR(value.as_ptr())),
        lpDirectory: directory
            .as_ref()
            .map_or(PCWSTR::null(), |value| PCWSTR(value.as_ptr())),
        nShow: SW_SHOWNORMAL.0,
        ..Default::default()
    };
    // SAFETY: `info` is fully initialized (`cbSize` set to its own size, remaining fields
    // defaulted), and its `lpVerb`/`lpFile`/`lpParameters`/`lpDirectory` point at `operation`,
    // `file`, and the optional NUL-terminated UTF-16 parameter and directory buffers owned by this
    // frame that outlive the call. `ShellExecuteExW` writes back into `info` through the exclusive
    // `&mut`, and `SEE_MASK_NOCLOSEPROCESS` makes any returned `hProcess` ours to close — which
    // `OwnedProcessHandle` then does exactly once. With the `runas` verb the call blocks until the
    // consent prompt is answered, and a dismissed prompt is reported as `ERROR_CANCELLED`.
    unsafe { ShellExecuteExW(&mut info) }?;
    if info.hProcess.is_invalid() {
        Ok(None)
    } else {
        Ok(Some(OwnedProcessHandle(info.hProcess.0 as isize)))
    }
}

pub(super) fn shell_open(target: &str, directory: Option<&str>) -> Result<(), String> {
    let operation = wide("open");
    let file = wide(target);
    let directory = directory.map(wide);
    // SAFETY: every `PCWSTR` here points at a NUL-terminated UTF-16 buffer owned by this frame that
    // outlives the call, and the parameter argument is explicitly null, which `ShellExecuteW`
    // documents as "no parameters". No handle is returned to own — this variant does not set
    // `SEE_MASK_NOCLOSEPROCESS` — so the result is only an error code, checked by
    // `validate_shell_result`.
    let result = unsafe {
        ShellExecuteW(
            None,
            PCWSTR(operation.as_ptr()),
            PCWSTR(file.as_ptr()),
            PCWSTR::null(),
            directory
                .as_ref()
                .map_or(PCWSTR::null(), |value| PCWSTR(value.as_ptr())),
            SW_SHOWNORMAL,
        )
    };
    validate_shell_result(result.0 as isize)
}

fn validate_shell_result(result: isize) -> Result<(), String> {
    if result > 32 {
        Ok(())
    } else {
        Err(format!(
            "Windows Shell could not launch the application (code {result})"
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_shell_execute_success_values() {
        assert!(validate_shell_result(33).is_ok());
    }

    #[test]
    fn rejects_shell_execute_error_values() {
        assert!(validate_shell_result(31).is_err());
    }

    #[test]
    fn wide_strings_end_with_one_nul() {
        assert_eq!(wide("ab"), vec![97, 98, 0]);
    }
}
