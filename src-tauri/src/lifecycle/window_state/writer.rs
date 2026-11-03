use super::store::{write, WindowPreferences};
use crate::lifecycle::LifecycleState;
use std::sync::{Condvar, Mutex, PoisonError};
use std::{io, path::Path};

#[derive(Default)]
pub(crate) struct WindowStateWriter {
    busy: Mutex<bool>,
    released: Condvar,
}

struct WritePermit<'a>(&'a WindowStateWriter);

impl Drop for WritePermit<'_> {
    fn drop(&mut self) {
        *self.0.busy.lock().unwrap_or_else(PoisonError::into_inner) = false;
        self.0.released.notify_one();
    }
}

impl WindowStateWriter {
    pub(crate) fn write(
        &self,
        lifecycle: &LifecycleState,
        directory: &Path,
        hide_to_tray: Option<bool>,
    ) -> io::Result<bool> {
        self.write_with(lifecycle, hide_to_tray, |preferences| {
            write(directory, preferences)
        })
    }

    fn write_with(
        &self,
        lifecycle: &LifecycleState,
        hide_to_tray: Option<bool>,
        write: impl FnOnce(&WindowPreferences) -> io::Result<bool>,
    ) -> io::Result<bool> {
        let busy = self.busy.lock().unwrap_or_else(PoisonError::into_inner);
        let mut busy = self
            .released
            .wait_while(busy, |busy| *busy)
            .unwrap_or_else(PoisonError::into_inner);
        *busy = true;
        drop(busy);
        let _permit = WritePermit(self);
        let preferences = WindowPreferences {
            geometry: lifecycle.geometry(),
            hide_to_tray: hide_to_tray.unwrap_or_else(|| lifecycle.hides_to_tray()),
        };
        let result = write(&preferences)?;
        if let Some(hide_to_tray) = hide_to_tray {
            lifecycle.set_hides_to_tray(hide_to_tray);
        }
        Ok(result)
    }
}

#[cfg(test)]
mod tests;
