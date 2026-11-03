use super::quiet_start::QuietStartGate;
use super::window_state::{WindowGeometry, WindowStateWriter};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;

pub(crate) struct LifecycleState {
    window_writer: WindowStateWriter,
    quitting: AtomicBool,
    hides_to_tray: AtomicBool,
    quiet_start: AtomicBool,
    startup_scan_gate: QuietStartGate,
    geometry: Mutex<Option<WindowGeometry>>,
    geometry_changes: AtomicU64,
    persist_pending: AtomicBool,
    mica_applied: AtomicBool,
}

impl Default for LifecycleState {
    fn default() -> Self {
        Self {
            window_writer: WindowStateWriter::default(),
            quitting: AtomicBool::new(false),
            hides_to_tray: AtomicBool::new(true),
            quiet_start: AtomicBool::new(false),
            startup_scan_gate: QuietStartGate::default(),
            geometry: Mutex::new(None),
            geometry_changes: AtomicU64::new(0),
            persist_pending: AtomicBool::new(false),
            mica_applied: AtomicBool::new(false),
        }
    }
}

impl LifecycleState {
    pub(crate) fn persist_window_preferences(
        &self,
        directory: &std::path::Path,
        hide_to_tray: Option<bool>,
    ) -> std::io::Result<bool> {
        self.window_writer.write(self, directory, hide_to_tray)
    }

    pub(crate) fn mark_quitting(&self) {
        self.quitting.store(true, Ordering::SeqCst);
    }

    pub(crate) fn begin_quiet_start(&self) {
        self.quiet_start.store(true, Ordering::SeqCst);
    }

    pub(crate) fn quiet_start(&self) -> bool {
        self.quiet_start.load(Ordering::SeqCst)
    }

    pub(crate) fn end_quiet_start(&self) -> bool {
        let ended = self.quiet_start.swap(false, Ordering::SeqCst);
        if ended {
            self.startup_scan_gate.wake();
        }
        ended
    }

    pub(crate) fn wait_out_quiet_start(&self, timeout: Duration) -> bool {
        if !self.quiet_start() {
            return false;
        }
        self.startup_scan_gate.wait(timeout);
        true
    }

    pub(crate) fn hides_to_tray(&self) -> bool {
        self.hides_to_tray.load(Ordering::SeqCst)
    }

    pub(crate) fn set_hides_to_tray(&self, hides_to_tray: bool) {
        self.hides_to_tray.store(hides_to_tray, Ordering::SeqCst);
    }

    pub(crate) fn should_hide_on_close(&self) -> bool {
        !self.quitting.load(Ordering::SeqCst) && self.hides_to_tray()
    }

    pub(crate) fn geometry(&self) -> Option<WindowGeometry> {
        self.geometry.lock().ok().and_then(|current| *current)
    }

    pub(crate) fn remember_geometry(&self, geometry: WindowGeometry) {
        if let Ok(mut current) = self.geometry.lock() {
            *current = Some(geometry);
        }
    }

    pub(crate) fn note_geometry_change(&self) -> u64 {
        self.geometry_changes.fetch_add(1, Ordering::SeqCst) + 1
    }

    pub(crate) fn geometry_changes(&self) -> u64 {
        self.geometry_changes.load(Ordering::SeqCst)
    }

    pub(crate) fn claim_persist(&self) -> bool {
        !self.persist_pending.swap(true, Ordering::SeqCst)
    }

    pub(crate) fn release_persist(&self) {
        self.persist_pending.store(false, Ordering::SeqCst);
    }

    pub(crate) fn mark_mica_applied(&self) {
        self.mica_applied.store(true, Ordering::SeqCst);
    }

    pub(crate) fn mica_applied(&self) -> bool {
        self.mica_applied.load(Ordering::SeqCst)
    }
}

#[cfg(test)]
mod tests;
