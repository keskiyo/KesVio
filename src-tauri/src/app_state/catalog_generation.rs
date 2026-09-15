use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Default)]
pub(crate) struct CatalogGeneration(AtomicU64);

impl CatalogGeneration {
    pub(crate) fn observe(&self, generation: u64) {
        self.0.fetch_max(generation, Ordering::Relaxed);
    }

    pub(crate) fn next(&self, stored: u64) -> Option<u64> {
        self.0
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |current| {
                current.max(stored).checked_add(1)
            })
            .ok()
            .and_then(|previous| previous.max(stored).checked_add(1))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resetting_the_disk_cache_does_not_reuse_a_published_generation() {
        let clock = CatalogGeneration::default();
        clock.observe(40);
        assert_eq!(clock.next(40), Some(41));
        assert_eq!(clock.next(0), Some(42));
        clock.observe(3);
        assert_eq!(clock.next(0), Some(43));
    }

    #[test]
    fn a_restarted_process_advances_from_the_stored_generation() {
        assert_eq!(CatalogGeneration::default().next(43), Some(44));
    }

    #[test]
    fn exhaustion_does_not_wrap_or_repeat_a_generation() {
        assert_eq!(CatalogGeneration::default().next(u64::MAX), None);
    }
}
