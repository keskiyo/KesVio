use windows::Win32::System::Threading::{
    GetCurrentProcess, SetPriorityClass, BELOW_NORMAL_PRIORITY_CLASS, NORMAL_PRIORITY_CLASS,
    PROCESS_CREATION_FLAGS,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum OwnPriority {
    BelowNormal,
    Normal,
}

impl OwnPriority {
    fn class(self) -> PROCESS_CREATION_FLAGS {
        match self {
            Self::BelowNormal => BELOW_NORMAL_PRIORITY_CLASS,
            Self::Normal => NORMAL_PRIORITY_CLASS,
        }
    }
}

pub(crate) fn set_own_priority(priority: OwnPriority) {
    // SAFETY: `GetCurrentProcess` returns a pseudo-handle for the calling process that is always
    // valid, needs no closing and cannot refer to any other process, so `SetPriorityClass` can
    // only change this process's own scheduling class. The flag is one of the two documented
    // priority classes. The call touches no memory the caller owns and is safe from any thread.
    let result = unsafe { SetPriorityClass(GetCurrentProcess(), priority.class()) };
    match result {
        Ok(()) => log::info!("Process priority set: {priority:?}"),
        Err(error) => log::warn!("Process priority unchanged: {priority:?} error={error}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_priority_maps_to_its_windows_class() {
        assert_eq!(
            OwnPriority::BelowNormal.class(),
            BELOW_NORMAL_PRIORITY_CLASS
        );
        assert_eq!(OwnPriority::Normal.class(), NORMAL_PRIORITY_CLASS);
    }
}
