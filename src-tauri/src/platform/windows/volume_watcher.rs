use std::sync::mpsc;
use std::sync::Arc;
use std::thread::JoinHandle;
use std::time::Duration;
use windows::core::w;
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DestroyWindow, DispatchMessageW, GetMessageW, PostThreadMessageW,
    DBT_DEVICEARRIVAL, DBT_DEVICEREMOVECOMPLETE, DBT_DEVTYP_VOLUME, DEV_BROADCAST_HDR,
    DEV_BROADCAST_VOLUME, MSG, WINDOW_EX_STYLE, WM_DEVICECHANGE, WM_QUIT, WS_OVERLAPPED,
};

const SUBCLASS_ID: usize = 0x4B56;

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) enum VolumeChange {
    Arrived(Vec<char>),
    Removed(Vec<char>),
}

impl VolumeChange {
    pub(crate) fn letters(&self) -> &[char] {
        match self {
            Self::Arrived(letters) | Self::Removed(letters) => letters,
        }
    }
}

pub(crate) type VolumeCallback = Arc<dyn Fn(VolumeChange) + Send + Sync>;

pub(crate) struct VolumeWatcherGuard {
    thread: Option<JoinHandle<()>>,
    thread_id: u32,
    #[cfg(test)]
    window: isize,
}

impl Drop for VolumeWatcherGuard {
    fn drop(&mut self) {
        // SAFETY: `PostThreadMessageW` takes no pointer — both parameters are integers. The
        // thread id was reported by the watcher thread itself and a guard is only built while
        // that thread is running; the join below keeps it alive until the message is consumed.
        // Posting to a thread that has already exited fails with an error rather than being
        // unsound, and the result is ignored.
        let _ = unsafe { PostThreadMessageW(self.thread_id, WM_QUIT, WPARAM(0), LPARAM(0)) };
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

struct Ready {
    thread_id: u32,
    #[cfg(test)]
    window: isize,
}

pub(crate) fn start(on_change: VolumeCallback) -> Option<VolumeWatcherGuard> {
    let (ready_sender, ready_receiver) = mpsc::channel::<Option<Ready>>();
    let thread = std::thread::spawn(move || {
        let callback = Box::new(on_change);
        // SAFETY: every call in this block is thread-affine and runs on this one spawned thread,
        // which owns the window for its whole life. `CreateWindowExW` receives only static
        // NUL-terminated class and title strings and no parent, menu, instance or creation
        // parameter; the stock `STATIC` class needs no registration. `SetWindowSubclass` stores
        // the address of `callback` as reference data: the box is a stack local of this closure
        // that is dropped only after `RemoveWindowSubclass` and `DestroyWindow` below, so the
        // subclass procedure never dereferences it after it is gone, and the procedure only
        // reads it. The message loop hands every message to `DispatchMessageW`, which is what
        // routes a `WM_DEVICECHANGE` sent from another thread into the subclass procedure, and
        // exits only on `WM_QUIT` — including the late-registration path where the guard's
        // `WM_QUIT` is already queued when the loop starts.
        unsafe {
            let Ok(window) = CreateWindowExW(
                WINDOW_EX_STYLE(0),
                w!("STATIC"),
                w!("KesVio volume watcher"),
                WS_OVERLAPPED,
                0,
                0,
                0,
                0,
                None,
                None,
                None,
                None,
            ) else {
                let _ = ready_sender.send(None);
                return;
            };
            let reference = std::ptr::addr_of!(*callback) as usize;
            if !SetWindowSubclass(window, Some(subclass_proc), SUBCLASS_ID, reference).as_bool() {
                let _ = DestroyWindow(window);
                let _ = ready_sender.send(None);
                return;
            }
            if ready_sender
                .send(Some(Ready {
                    thread_id: GetCurrentThreadId(),
                    #[cfg(test)]
                    window: window.0 as isize,
                }))
                .is_err()
            {
                let _ = RemoveWindowSubclass(window, Some(subclass_proc), SUBCLASS_ID);
                let _ = DestroyWindow(window);
                return;
            }
            let mut message = MSG::default();
            while GetMessageW(&mut message, None, 0, 0).as_bool() {
                DispatchMessageW(&message);
            }
            let _ = RemoveWindowSubclass(window, Some(subclass_proc), SUBCLASS_ID);
            let _ = DestroyWindow(window);
        }
        drop(callback);
    });
    finish_start(thread, ready_receiver, Duration::from_secs(2))
}

fn finish_start(
    thread: JoinHandle<()>,
    ready_receiver: mpsc::Receiver<Option<Ready>>,
    timeout: Duration,
) -> Option<VolumeWatcherGuard> {
    match ready_receiver.recv_timeout(timeout) {
        Ok(Some(ready)) => Some(VolumeWatcherGuard {
            thread: Some(thread),
            thread_id: ready.thread_id,
            #[cfg(test)]
            window: ready.window,
        }),
        _ => {
            drop(ready_receiver);
            let _ = thread.join();
            None
        }
    }
}

unsafe extern "system" fn subclass_proc(
    window: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _subclass_id: usize,
    reference: usize,
) -> LRESULT {
    if message == WM_DEVICECHANGE {
        if let Some(change) = volume_change(wparam, lparam) {
            // SAFETY: `reference` is the address `start` stored with `SetWindowSubclass`: a boxed
            // callback that outlives the subclass, because `start` removes the subclass before
            // dropping the box, and no message can reach this procedure after removal.
            let callback = unsafe { &*(reference as *const VolumeCallback) };
            callback(change);
        }
    }
    // SAFETY: forwarding the untouched message to the original window procedure is the
    // documented contract of a subclass procedure; all four values come straight from the caller.
    unsafe { DefSubclassProc(window, message, wparam, lparam) }
}

fn volume_change(wparam: WPARAM, lparam: LPARAM) -> Option<VolumeChange> {
    let event = u32::try_from(wparam.0).ok()?;
    if event != DBT_DEVICEARRIVAL && event != DBT_DEVICEREMOVECOMPLETE {
        return None;
    }
    let header = lparam.0 as *const DEV_BROADCAST_HDR;
    if header.is_null() {
        return None;
    }
    // SAFETY: for `DBT_DEVICEARRIVAL` and `DBT_DEVICEREMOVECOMPLETE` Windows documents `lParam`
    // as a pointer to a `DEV_BROADCAST_HDR` that stays valid for the duration of the message;
    // the null case was rejected above, and the header is read before anything past it.
    let header = unsafe { header.read_unaligned() };
    if header.dbch_devicetype != DBT_DEVTYP_VOLUME
        || (header.dbch_size as usize) < std::mem::size_of::<DEV_BROADCAST_VOLUME>()
    {
        return None;
    }
    // SAFETY: the header declares the volume device type and a size that covers the whole
    // `DEV_BROADCAST_VOLUME`, so the same pointer addresses a complete volume structure.
    let volume = unsafe { (lparam.0 as *const DEV_BROADCAST_VOLUME).read_unaligned() };
    let letters = drive_letters(volume.dbcv_unitmask);
    if letters.is_empty() {
        return None;
    }
    Some(if event == DBT_DEVICEARRIVAL {
        VolumeChange::Arrived(letters)
    } else {
        VolumeChange::Removed(letters)
    })
}

fn drive_letters(unit_mask: u32) -> Vec<char> {
    (0..26u8)
        .filter(|index| unit_mask & (1 << index) != 0)
        .map(|index| char::from(b'A' + index))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;
    use std::time::Instant;
    use windows::Win32::UI::WindowsAndMessaging::SendMessageW;

    fn send(guard: &VolumeWatcherGuard, event: u32, volume: Option<&DEV_BROADCAST_VOLUME>) {
        let payload = volume.map_or(0, |volume| std::ptr::from_ref(volume) as isize);
        // SAFETY: the window belongs to the live watcher thread, which pumps messages until the
        // guard is dropped; `SendMessageW` blocks until the procedure returns, so `volume` — a
        // live local of the caller — outlives every read of it.
        unsafe {
            SendMessageW(
                HWND(guard.window as *mut _),
                WM_DEVICECHANGE,
                Some(WPARAM(event as usize)),
                Some(LPARAM(payload)),
            );
        }
    }

    fn volume(unit_mask: u32) -> DEV_BROADCAST_VOLUME {
        DEV_BROADCAST_VOLUME {
            dbcv_size: std::mem::size_of::<DEV_BROADCAST_VOLUME>() as u32,
            dbcv_devicetype: DBT_DEVTYP_VOLUME.0,
            dbcv_reserved: 0,
            dbcv_unitmask: unit_mask,
            dbcv_flags: Default::default(),
        }
    }

    #[test]
    fn unit_mask_bits_become_drive_letters() {
        assert_eq!(drive_letters(0), Vec::<char>::new());
        assert_eq!(drive_letters(1 << 5), vec!['F']);
        assert_eq!(drive_letters((1 << 2) | (1 << 25)), vec!['C', 'Z']);
    }

    #[test]
    fn a_volume_removal_reaches_the_callback_with_its_letters() {
        let seen = Arc::new(Mutex::new(Vec::new()));
        let sink = Arc::clone(&seen);
        let guard = start(Arc::new(move |change| sink.lock().unwrap().push(change)))
            .expect("the test process can create a hidden window");

        send(&guard, DBT_DEVICEREMOVECOMPLETE, Some(&volume(1 << 5)));
        send(
            &guard,
            DBT_DEVICEARRIVAL,
            Some(&volume((1 << 4) | (1 << 6))),
        );

        assert_eq!(
            *seen.lock().unwrap(),
            vec![
                VolumeChange::Removed(vec!['F']),
                VolumeChange::Arrived(vec!['E', 'G']),
            ]
        );
    }

    #[test]
    fn other_device_events_and_broken_payloads_are_ignored() {
        let seen = Arc::new(Mutex::new(Vec::new()));
        let sink = Arc::clone(&seen);
        let guard = start(Arc::new(move |change| sink.lock().unwrap().push(change)))
            .expect("the test process can create a hidden window");
        let mut port = volume(1 << 5);
        port.dbcv_devicetype = DBT_DEVTYP_VOLUME.0 + 1;
        let mut short = volume(1 << 5);
        short.dbcv_size = std::mem::size_of::<DEV_BROADCAST_HDR>() as u32;

        send(&guard, DBT_DEVICEREMOVECOMPLETE, None);
        send(&guard, DBT_DEVICEREMOVECOMPLETE, Some(&port));
        send(&guard, DBT_DEVICEREMOVECOMPLETE, Some(&short));
        send(&guard, DBT_DEVICEREMOVECOMPLETE, Some(&volume(0)));
        send(&guard, 0x0007, Some(&volume(1 << 5)));

        assert!(seen.lock().unwrap().is_empty());
    }

    #[test]
    fn dropping_the_guard_stops_the_message_loop_promptly() {
        let guard = start(Arc::new(|_| {})).expect("the test process can create a hidden window");
        let started = Instant::now();

        drop(guard);

        assert!(started.elapsed() < Duration::from_secs(2));
    }

    #[test]
    fn a_late_registration_exits_when_the_ready_receiver_timed_out() {
        use std::sync::atomic::{AtomicBool, Ordering};

        let (sender, receiver) = mpsc::channel::<Option<Ready>>();
        let rejected = Arc::new(AtomicBool::new(false));
        let worker_rejected = Arc::clone(&rejected);
        let thread = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(20));
            worker_rejected.store(
                sender
                    .send(Some(Ready {
                        thread_id: 1,
                        window: 0,
                    }))
                    .is_err(),
                Ordering::Relaxed,
            );
        });

        assert!(finish_start(thread, receiver, Duration::ZERO).is_none());
        assert!(rejected.load(Ordering::Relaxed));
    }
}
