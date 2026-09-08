use std::cell::RefCell;
use std::sync::Once;

thread_local! {
    static LINES: RefCell<Vec<String>> = const { RefCell::new(Vec::new()) };
}

struct TestLog;
static LOGGER: TestLog = TestLog;
static INSTALL: Once = Once::new();

impl log::Log for TestLog {
    fn enabled(&self, _: &log::Metadata<'_>) -> bool {
        true
    }
    fn log(&self, record: &log::Record<'_>) {
        LINES.with_borrow_mut(|lines| lines.push(record.args().to_string()));
    }
    fn flush(&self) {}
}

pub(crate) fn capture(test: impl FnOnce()) {
    INSTALL.call_once(|| {
        log::set_logger(&LOGGER).unwrap();
        log::set_max_level(log::LevelFilter::Info);
    });
    LINES.with_borrow_mut(Vec::clear);
    test();
}

pub(crate) fn lines() -> Vec<String> {
    LINES.with_borrow(Clone::clone)
}
