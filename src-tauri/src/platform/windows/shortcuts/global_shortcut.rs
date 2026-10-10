mod binding;
mod store;

pub(crate) use binding::Binding;

use serde::Serialize;
use std::io;
use std::path::Path;
use std::sync::mpsc;
use std::thread::JoinHandle;
use std::time::Duration;
use tauri::AppHandle;
use windows::Win32::Foundation::{LPARAM, WPARAM};
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::Input::KeyboardAndMouse::{RegisterHotKey, UnregisterHotKey};
use windows::Win32::UI::WindowsAndMessaging::{
    GetMessageW, PostThreadMessageW, MSG, WM_HOTKEY, WM_QUIT,
};

const HOTKEY_ID: i32 = 0x5741;
pub(crate) const LABEL: &str = "Win+Shift+Q";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Status {
    pub available: bool,
    pub pending: bool,
    pub label: String,
    pub error: Option<&'static str>,
}

impl Default for Status {
    fn default() -> Self {
        Self {
            available: false,
            pending: true,
            label: LABEL.into(),
            error: Some("The shortcut has not been registered yet."),
        }
    }
}

impl Status {
    pub(crate) fn pending(binding: &Binding) -> Self {
        Self {
            available: false,
            pending: true,
            label: binding.label().unwrap_or_else(|()| LABEL.into()),
            error: Some("The shortcut has not been registered yet."),
        }
    }

    fn registered(binding: &Binding) -> Self {
        Self {
            available: true,
            pending: false,
            label: binding.label().unwrap_or_else(|()| LABEL.into()),
            error: None,
        }
    }

    fn unavailable(binding: &Binding) -> Self {
        Self {
            available: false,
            pending: false,
            label: binding.label().unwrap_or_else(|()| LABEL.into()),
            error: Some(
                "The shortcut could not be registered. Another application may already use it.",
            ),
        }
    }
}

pub(crate) struct RegisteredShortcut {
    pub status: Status,
    pub guard: Option<ShortcutGuard>,
}

pub(crate) struct ShortcutGuard {
    thread: Option<JoinHandle<()>>,
    thread_id: u32,
}

impl Drop for ShortcutGuard {
    fn drop(&mut self) {
        // SAFETY: `PostThreadMessageW` takes no pointer — both parameters are integers. The
        // thread id was reported by the hotkey thread itself and a `ShortcutGuard` is only built
        // while that thread is running; the join below is what guarantees it is still alive here,
        // because `Drop` runs before the `JoinHandle` is released. Posting to a thread that has
        // already exited fails with an error rather than being unsound, and the result is ignored.
        let _ = unsafe { PostThreadMessageW(self.thread_id, WM_QUIT, WPARAM(0), LPARAM(0)) };
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

pub(crate) fn read(app_data_dir: &Path) -> Binding {
    store::read(app_data_dir)
}

pub(crate) fn write(app_data_dir: &Path, binding: &Binding) -> io::Result<()> {
    store::write(app_data_dir, binding)
}

pub(crate) fn register(app: AppHandle, binding: Binding) -> RegisteredShortcut {
    let Ok(modifiers) = binding.modifiers() else {
        return RegisteredShortcut {
            status: Status::unavailable(&binding),
            guard: None,
        };
    };
    let Ok(virtual_key) = binding.virtual_key() else {
        return RegisteredShortcut {
            status: Status::unavailable(&binding),
            guard: None,
        };
    };
    let (id_sender, id_receiver) = mpsc::channel();
    let (status_sender, status_receiver) = mpsc::channel();
    // SAFETY: every call in this block is thread-affine, and all of them run on this one spawned
    // thread — which is exactly why the whole body is the unsafe region. `RegisterHotKey(None,…)`
    // associates the hotkey with the calling thread, `GetMessageW(None,…)` pumps that thread's own
    // queue, and `UnregisterHotKey` must be called from the registering thread; none of them take
    // a pointer from us except `&mut message`, a live local the callee fills. The loop exits only
    // on `WM_QUIT`, and unregistration is the last statement, so the hotkey is released before the
    // thread ends — including on the late-registration path, where the guard's `WM_QUIT` may
    // already be waiting in the queue when the loop starts.
    let thread = std::thread::spawn(move || unsafe {
        let _ = id_sender.send(GetCurrentThreadId());
        let registration = RegisterHotKey(None, HOTKEY_ID, modifiers, virtual_key);
        let _ = status_sender.send(registration.is_ok());
        if registration.is_err() {
            return;
        }
        let mut message = MSG::default();
        while GetMessageW(&mut message, None, 0, 0).as_bool() {
            if message.message == WM_HOTKEY && message.wParam.0 == HOTKEY_ID as usize {
                crate::lifecycle::request_search(&app);
            }
        }
        let _ = UnregisterHotKey(None, HOTKEY_ID);
    });
    let Ok(thread_id) = id_receiver.recv_timeout(Duration::from_secs(1)) else {
        let _ = thread.join();
        return RegisteredShortcut {
            status: Status::unavailable(&binding),
            guard: None,
        };
    };
    let available = status_receiver
        .recv_timeout(Duration::from_secs(1))
        .unwrap_or(false);
    RegisteredShortcut {
        status: if available {
            Status::registered(&binding)
        } else {
            Status::unavailable(&binding)
        },
        guard: Some(ShortcutGuard {
            thread: Some(thread),
            thread_id,
        }),
    }
}

#[cfg(test)]
#[path = "global_shortcut/registration_tests.rs"]
mod tests;
