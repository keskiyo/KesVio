use std::collections::BTreeSet;
use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};
use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, HANDLE, WAIT_OBJECT_0};
use windows::Win32::Storage::FileSystem::{
    CreateFileW, ReadDirectoryChangesW, FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OVERLAPPED,
    FILE_LIST_DIRECTORY, FILE_NOTIFY_CHANGE_DIR_NAME, FILE_NOTIFY_CHANGE_FILE_NAME,
    FILE_NOTIFY_CHANGE_LAST_WRITE, FILE_NOTIFY_CHANGE_SIZE, FILE_SHARE_DELETE, FILE_SHARE_READ,
    FILE_SHARE_WRITE, OPEN_EXISTING,
};
use windows::Win32::System::Registry::{
    RegCloseKey, RegNotifyChangeKeyValue, RegOpenKeyExW, HKEY, HKEY_CURRENT_USER,
    HKEY_LOCAL_MACHINE, KEY_NOTIFY, REG_NOTIFY_CHANGE_LAST_SET, REG_NOTIFY_CHANGE_NAME,
};
use windows::Win32::System::Threading::{CreateEventW, SetEvent, WaitForMultipleObjects, INFINITE};
use windows::Win32::System::IO::{CancelIoEx, GetOverlappedResult, OVERLAPPED};

const DEBOUNCE_DELAY: Duration = Duration::from_secs(8);
const MIN_DISPATCH_INTERVAL: Duration = Duration::from_secs(30);
const EVENT_BUFFER: usize = 64;

#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub(crate) enum ChangeOrigin {
    Registry,
    Directory(PathBuf),
    Unknown,
}

#[derive(Default)]
struct DebounceState {
    pending: BTreeSet<ChangeOrigin>,
    last_event: Option<Instant>,
    last_dispatch: Option<Instant>,
}

impl DebounceState {
    fn push(&mut self, origin: ChangeOrigin, now: Instant) {
        self.pending.insert(origin);
        self.last_event = Some(now);
    }

    fn take_if_ready(
        &mut self,
        now: Instant,
        delay: Duration,
        interval: Duration,
    ) -> Option<Vec<ChangeOrigin>> {
        let quiet = self
            .last_event
            .is_some_and(|last| now.saturating_duration_since(last) >= delay);
        let interval_elapsed = self
            .last_dispatch
            .is_none_or(|last| now.saturating_duration_since(last) >= interval);
        if quiet && interval_elapsed && !self.pending.is_empty() {
            self.last_event = None;
            self.last_dispatch = Some(now);
            return Some(std::mem::take(&mut self.pending).into_iter().collect());
        }
        None
    }
}

pub(crate) struct WatcherGuard {
    stop: Arc<AtomicBool>,
    stop_event: isize,
    threads: Vec<JoinHandle<()>>,
}

#[derive(Clone, Copy)]
enum RegistryRoot {
    LocalMachine,
    CurrentUser,
}

impl Drop for WatcherGuard {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Release);
        let stop_event = HANDLE(self.stop_event as *mut _);
        // SAFETY: `stop_event` was created by `start` and is owned by this guard; it is not closed
        // until after the join below, so every watcher thread is still waiting on a live handle.
        // Setting a manual-reset event releases all of them at once.
        let _ = unsafe { SetEvent(stop_event) };
        for thread in self.threads.drain(..) {
            let _ = thread.join();
        }
        // SAFETY: the close happens only after every thread that borrowed this handle has been
        // joined, so no wait can still reference it. `Drop` runs once, so it is closed once.
        let _ = unsafe { CloseHandle(stop_event) };
    }
}

pub(crate) fn start(
    paths: Vec<PathBuf>,
    on_change: Arc<dyn Fn(Vec<ChangeOrigin>) + Send + Sync>,
) -> Option<WatcherGuard> {
    let stop = Arc::new(AtomicBool::new(false));
    // SAFETY: `CreateEventW` takes no caller-owned memory here — default security attributes, and
    // a null name. It is created manual-reset (`true`) and unsignalled (`false`) so a single
    // `SetEvent` in `Drop` releases every watcher thread at once. Ownership stays with
    // `WatcherGuard`, which closes it after joining; failure returns `None` rather than leaving
    // threads that could never be woken.
    let Ok(stop_event) = (unsafe { CreateEventW(None, true, false, PCWSTR::null()) }) else {
        return None;
    };
    let (sender, receiver) = mpsc::sync_channel::<ChangeOrigin>(EVENT_BUFFER);
    let overflowed = Arc::new(AtomicBool::new(false));
    let mut threads = Vec::new();
    let debounce_stop = Arc::clone(&stop);
    let debounce_overflowed = Arc::clone(&overflowed);
    threads.push(std::thread::spawn(move || {
        let mut state = DebounceState::default();
        while !debounce_stop.load(Ordering::Acquire) {
            match receiver.recv_timeout(Duration::from_millis(200)) {
                Ok(origin) => state.push(origin, Instant::now()),
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
            for _ in 0..EVENT_BUFFER {
                let Ok(origin) = receiver.try_recv() else {
                    break;
                };
                state.push(origin, Instant::now());
            }
            if debounce_overflowed.swap(false, Ordering::AcqRel) {
                state.push(ChangeOrigin::Unknown, Instant::now());
            }
            if let Some(origins) =
                state.take_if_ready(Instant::now(), DEBOUNCE_DELAY, MIN_DISPATCH_INTERVAL)
            {
                on_change(origins);
            }
        }
    }));

    for path in paths {
        if path.is_dir() {
            threads.push(spawn_directory_watcher(
                path,
                sender.clone(),
                Arc::clone(&overflowed),
                Arc::clone(&stop),
                stop_event.0 as isize,
            ));
        }
    }
    for (root, subkey) in [
        (
            RegistryRoot::LocalMachine,
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
        (
            RegistryRoot::LocalMachine,
            r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
        (
            RegistryRoot::CurrentUser,
            r"Software\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
    ] {
        threads.push(spawn_registry_watcher(
            root,
            subkey,
            sender.clone(),
            Arc::clone(&overflowed),
            Arc::clone(&stop),
            stop_event.0 as isize,
        ));
    }
    Some(WatcherGuard {
        stop,
        stop_event: stop_event.0 as isize,
        threads,
    })
}

fn spawn_directory_watcher(
    path: PathBuf,
    sender: mpsc::SyncSender<ChangeOrigin>,
    overflowed: Arc<AtomicBool>,
    stop: Arc<AtomicBool>,
    stop_event: isize,
) -> JoinHandle<()> {
    std::thread::spawn(move || {
        let stop_event = HANDLE(stop_event as *mut _);
        let wide = wide(path.as_os_str());
        let origin = ChangeOrigin::Directory(path);
        // SAFETY: `wide` is a NUL-terminated UTF-16 buffer alive for the call; the two `None`
        // arguments are the optional security attributes and template handle.
        // `FILE_FLAG_BACKUP_SEMANTICS` is what makes opening a *directory* handle legal, and
        // `FILE_FLAG_OVERLAPPED` is required by the asynchronous `ReadDirectoryChangesW` below.
        // The handle is closed on every exit path of this thread.
        let handle = unsafe {
            CreateFileW(
                PCWSTR(wide.as_ptr()),
                FILE_LIST_DIRECTORY.0,
                FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                None,
                OPEN_EXISTING,
                FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OVERLAPPED,
                None,
            )
        };
        let Ok(handle) = handle else {
            return;
        };
        // SAFETY: as for the stop event, but auto-reset: it is signalled once per completed read
        // and consumed by the wait below. On failure the directory handle opened above is closed
        // before returning, so the early exit leaks nothing.
        let change_event = match unsafe { CreateEventW(None, false, false, PCWSTR::null()) } {
            Ok(event) => event,
            Err(_) => {
                // SAFETY: `handle` is the live directory handle from this thread, closed once.
                let _ = unsafe { CloseHandle(handle) };
                return;
            }
        };
        let mut buffer = vec![0u8; 16 * 1024];
        let mut overlapped = OVERLAPPED {
            hEvent: change_event,
            ..Default::default()
        };
        while !stop.load(Ordering::Acquire) {
            // SAFETY: this starts an *asynchronous* read, so the kernel keeps writing into
            // `buffer` and `overlapped` after the call returns. Both are declared outside the loop
            // and outlive every exit path: the `WAIT_OBJECT_0` branch cancels the operation and
            // then blocks in `GetOverlappedResult` until it has really finished, and the error
            // branch only breaks after the call itself failed to queue anything. The declared
            // length matches `buffer`'s real length, so the kernel cannot write past it.
            // `overlapped.hEvent` is the auto-reset event waited on below.
            if unsafe {
                ReadDirectoryChangesW(
                    handle,
                    buffer.as_mut_ptr().cast(),
                    buffer.len() as u32,
                    true,
                    FILE_NOTIFY_CHANGE_FILE_NAME
                        | FILE_NOTIFY_CHANGE_DIR_NAME
                        | FILE_NOTIFY_CHANGE_LAST_WRITE
                        | FILE_NOTIFY_CHANGE_SIZE,
                    None,
                    Some(&mut overlapped),
                    None,
                )
            }
            .is_err()
            {
                break;
            }
            // SAFETY: both handles are live — the stop event is kept open by `WatcherGuard` until
            // after this thread is joined, and the change event is closed only after this loop.
            // The slice is a live local array of exactly the two handles being waited on.
            let wait =
                unsafe { WaitForMultipleObjects(&[stop_event, change_event], false, INFINITE) };
            if wait == WAIT_OBJECT_0 {
                // SAFETY: `handle` is live and `overlapped` identifies the read queued above and
                // is still at its original address — it is declared outside the loop precisely so
                // the kernel's pointer stays valid until the wait below confirms completion.
                let _ = unsafe { CancelIoEx(handle, Some(&overlapped)) };
                let mut transferred = 0_u32;
                // SAFETY: the `true` argument blocks until the cancelled I/O has actually
                // completed, which is what makes it safe for `buffer` and `overlapped` to be
                // dropped when this thread returns. `transferred` is a live local.
                let _ = unsafe { GetOverlappedResult(handle, &overlapped, &mut transferred, true) };
                break;
            }
            if wait.0 == WAIT_OBJECT_0.0 + 1 && !report_change(&sender, &overflowed, origin.clone())
            {
                break;
            }
        }
        // SAFETY: both handles were created by this thread, no I/O is still pending on them (the
        // loop either never queued a read or waited for its completion above), and this is the
        // single close for each.
        let _ = unsafe { CloseHandle(change_event) };
        let _ = unsafe { CloseHandle(handle) };
    })
}

fn spawn_registry_watcher(
    root: RegistryRoot,
    subkey: &'static str,
    sender: mpsc::SyncSender<ChangeOrigin>,
    overflowed: Arc<AtomicBool>,
    stop: Arc<AtomicBool>,
    stop_event: isize,
) -> JoinHandle<()> {
    std::thread::spawn(move || {
        let stop_event = HANDLE(stop_event as *mut _);
        let root = match root {
            RegistryRoot::LocalMachine => HKEY_LOCAL_MACHINE,
            RegistryRoot::CurrentUser => HKEY_CURRENT_USER,
        };
        let wide = wide(OsStr::new(subkey));
        let mut key = HKEY::default();
        // SAFETY: `root` is a predefined hive handle, `wide` is a NUL-terminated UTF-16 subkey
        // alive for the call, and `key` is a live local the callee writes. A missing key (the
        // WOW6432Node hive on a 32-bit-only system, for example) is an error return, and the
        // thread exits before `key` is used.
        if unsafe { RegOpenKeyExW(root, PCWSTR(wide.as_ptr()), None, KEY_NOTIFY, &mut key) }
            .is_err()
        {
            return;
        }
        // SAFETY: an auto-reset, unnamed event with default security, as above. On failure the
        // key opened above is closed before returning.
        let change_event = match unsafe { CreateEventW(None, false, false, PCWSTR::null()) } {
            Ok(event) => event,
            Err(_) => {
                // SAFETY: `key` was successfully opened above and is closed once.
                let _ = unsafe { RegCloseKey(key) };
                return;
            }
        };
        while !stop.load(Ordering::Acquire) {
            // SAFETY: `key` is open for the whole loop and `change_event` outlives it. The
            // notification is asynchronous, but unlike the directory watcher it writes nothing
            // into our memory — it only signals the event — so no buffer has to stay alive.
            // Re-arming each iteration is required: a registry notification is one-shot.
            if unsafe {
                RegNotifyChangeKeyValue(
                    key,
                    true,
                    REG_NOTIFY_CHANGE_NAME | REG_NOTIFY_CHANGE_LAST_SET,
                    Some(change_event),
                    true,
                )
            }
            .is_err()
            {
                break;
            }
            // SAFETY: both handles are live for the same reasons as in the directory watcher —
            // the stop event outlives every watcher thread, the change event outlives this loop.
            let wait =
                unsafe { WaitForMultipleObjects(&[stop_event, change_event], false, INFINITE) };
            if wait == WAIT_OBJECT_0 {
                break;
            }
            if wait.0 == WAIT_OBJECT_0.0 + 1
                && !report_change(&sender, &overflowed, ChangeOrigin::Registry)
            {
                break;
            }
        }
        // SAFETY: both were created/opened by this thread and are released once. A pending
        // registry notification does not reference caller memory, so no completion wait is needed
        // before closing — unlike the overlapped directory read.
        let _ = unsafe { CloseHandle(change_event) };
        let _ = unsafe { RegCloseKey(key) };
    })
}

fn report_change(
    sender: &mpsc::SyncSender<ChangeOrigin>,
    overflowed: &AtomicBool,
    origin: ChangeOrigin,
) -> bool {
    match sender.try_send(origin) {
        Ok(()) => true,
        Err(mpsc::TrySendError::Full(_)) => {
            overflowed.store(true, Ordering::Release);
            true
        }
        Err(mpsc::TrySendError::Disconnected(_)) => false,
    }
}

fn wide(value: &OsStr) -> Vec<u16> {
    value.encode_wide().chain(Some(0)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn debounce_unions_origins_and_waits_for_quiet() {
        let now = Instant::now();
        let mut state = DebounceState::default();
        state.push(ChangeOrigin::Registry, now);
        state.push(
            ChangeOrigin::Directory(PathBuf::from(r"C:\Apps")),
            now + Duration::from_secs(1),
        );

        assert!(state
            .take_if_ready(
                now + Duration::from_secs(8),
                DEBOUNCE_DELAY,
                MIN_DISPATCH_INTERVAL,
            )
            .is_none());
        assert_eq!(
            state
                .take_if_ready(
                    now + Duration::from_secs(9),
                    DEBOUNCE_DELAY,
                    MIN_DISPATCH_INTERVAL,
                )
                .unwrap()
                .len(),
            2
        );
    }

    #[test]
    fn cooldown_keeps_dirty_origins_until_dispatch_is_allowed() {
        let now = Instant::now();
        let mut state = DebounceState::default();
        state.push(ChangeOrigin::Registry, now);
        assert!(state
            .take_if_ready(now + DEBOUNCE_DELAY, DEBOUNCE_DELAY, MIN_DISPATCH_INTERVAL,)
            .is_some());
        state.push(
            ChangeOrigin::Directory(PathBuf::from(r"C:\Apps")),
            now + Duration::from_secs(10),
        );
        assert!(state
            .take_if_ready(
                now + Duration::from_secs(20),
                DEBOUNCE_DELAY,
                MIN_DISPATCH_INTERVAL,
            )
            .is_none());
        assert!(state
            .take_if_ready(
                now + Duration::from_secs(38),
                DEBOUNCE_DELAY,
                MIN_DISPATCH_INTERVAL,
            )
            .is_some());
    }

    #[test]
    fn watcher_guard_stops_blocked_registry_watchers() {
        let started = Instant::now();
        let guard = start(Vec::new(), Arc::new(|_| {}));
        assert!(guard.is_some());
        drop(guard);
        assert!(started.elapsed() < Duration::from_secs(2));
    }

    #[test]
    fn repeated_start_and_stop_cycles_stay_responsive() {
        let directory = tempfile::tempdir().unwrap();
        for _ in 0..5 {
            let started = Instant::now();
            let guard = start(vec![directory.path().to_path_buf()], Arc::new(|_| {}));
            assert!(guard.is_some());
            drop(guard);
            assert!(started.elapsed() < Duration::from_secs(5));
        }
    }
}
