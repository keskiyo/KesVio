use super::*;

#[test]
fn shortcut_uses_the_physical_q_virtual_key() {
    assert_eq!(Binding::default().virtual_key(), Ok(0x51));
    assert_eq!(LABEL, "Win+Shift+Q");
}

#[test]
fn status_names_the_binding_that_was_registered() {
    let binding = Binding {
        win: false,
        ctrl: true,
        alt: true,
        shift: false,
        key: "Digit8".into(),
    };

    assert_eq!(Status::registered(&binding).label, "Ctrl+Alt+8");
    assert!(Status::registered(&binding).available);
    assert_eq!(Status::unavailable(&binding).label, "Ctrl+Alt+8");
    assert!(!Status::unavailable(&binding).available);
    assert_eq!(Status::pending(&binding).label, "Ctrl+Alt+8");
}

#[test]
fn status_tells_a_pending_registration_from_a_refused_one() {
    let binding = Binding::default();

    assert!(Status::default().pending);
    assert!(Status::pending(&binding).pending);
    assert!(!Status::registered(&binding).pending);
    assert!(!Status::unavailable(&binding).pending);
    assert_eq!(
        serde_json::to_value(Status::unavailable(&binding)).unwrap()["pending"],
        serde_json::Value::Bool(false)
    );
}

#[test]
fn dropping_the_guard_stops_the_message_loop_promptly() {
    let Some(guard) = register_for_test() else {
        return;
    };
    let started = std::time::Instant::now();

    drop(guard);

    assert!(started.elapsed() < Duration::from_secs(2));
}

#[test]
fn a_thread_whose_registration_failed_is_still_owned_and_joined() {
    let blocker = register_for_test();
    let started = std::time::Instant::now();

    let guard = spawn_hotkey_thread(false);

    assert!(
        guard.is_some(),
        "the thread must be owned even when it failed"
    );
    drop(guard);
    assert!(started.elapsed() < Duration::from_secs(4));
    drop(blocker);
}

fn register_for_test() -> Option<ShortcutGuard> {
    spawn_hotkey_thread(true)
}

fn spawn_hotkey_thread(require_registration: bool) -> Option<ShortcutGuard> {
    let (id_sender, id_receiver) = mpsc::channel();
    let (status_sender, status_receiver) = mpsc::channel();
    let binding = Binding::default();
    let modifiers = binding.modifiers().unwrap();
    let virtual_key = binding.virtual_key().unwrap();
    // SAFETY: registration, the message pump and unregistration stay on this spawned thread, and
    // the only pointer passed to Windows is a live local message buffer.
    let thread = std::thread::spawn(move || unsafe {
        let _ = id_sender.send(GetCurrentThreadId());
        let registration = RegisterHotKey(None, HOTKEY_ID, modifiers, virtual_key);
        let _ = status_sender.send(registration.is_ok());
        if registration.is_err() {
            return;
        }
        let mut message = MSG::default();
        while GetMessageW(&mut message, None, 0, 0).as_bool() {}
        let _ = UnregisterHotKey(None, HOTKEY_ID);
    });
    let thread_id = id_receiver.recv_timeout(Duration::from_secs(1)).ok()?;
    let registered = status_receiver
        .recv_timeout(Duration::from_secs(1))
        .unwrap_or(false);
    if require_registration && !registered {
        let _ = thread.join();
        return None;
    }
    Some(ShortcutGuard {
        thread: Some(thread),
        thread_id,
    })
}
