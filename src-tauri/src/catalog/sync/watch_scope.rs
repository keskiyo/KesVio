#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct WatchScope(u8);

impl WatchScope {
    pub(crate) const REGISTRY: Self = Self(1);
    pub(crate) const START_MENU: Self = Self(2);
    pub(crate) const PORTABLE: Self = Self(4);
    pub(crate) const ALL: Self = Self(1 | 2 | 4);

    pub(crate) const fn contains(self, other: Self) -> bool {
        self.0 & other.0 == other.0
    }

    pub(crate) const fn union(self, other: Self) -> Self {
        Self(self.0 | other.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scopes_union_without_expanding_to_all_sources() {
        let scope = WatchScope::START_MENU.union(WatchScope::PORTABLE);

        assert!(scope.contains(WatchScope::START_MENU));
        assert!(scope.contains(WatchScope::PORTABLE));
        assert!(!scope.contains(WatchScope::REGISTRY));
        assert_ne!(scope, WatchScope::ALL);
    }
}
