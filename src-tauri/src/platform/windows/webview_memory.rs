use tauri::webview::PlatformWebview;
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2_19, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL,
    COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
};
use windows::core::Interface;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum WebviewPresence {
    Foreground,
    Background,
}

fn controller_visible(presence: WebviewPresence) -> bool {
    presence == WebviewPresence::Foreground
}

fn memory_level(presence: WebviewPresence) -> COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL {
    match presence {
        WebviewPresence::Foreground => COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
        WebviewPresence::Background => COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW,
    }
}

pub(crate) fn apply(
    webview: &PlatformWebview,
    presence: WebviewPresence,
) -> windows::core::Result<()> {
    let controller = webview.controller();
    // SAFETY: `with_webview` runs the caller's closure on the thread that owns the WebView2
    // controller, which is the thread affinity every `ICoreWebView2Controller` and `ICoreWebView2`
    // call requires. `controller` is a reference-counted COM pointer cloned out of the live
    // `PlatformWebview`, so it stays valid for the whole block, and `CoreWebView2()` and `cast()`
    // return owned, AddRef'd interfaces that `Drop` releases. No raw pointer crosses in either
    // direction; every HRESULT is propagated, so a runtime without `ICoreWebView2_19` (WebView2
    // older than 114) fails the `cast` and leaves only the visibility applied.
    unsafe {
        controller.SetIsVisible(controller_visible(presence))?;
        let core: ICoreWebView2_19 = controller.CoreWebView2()?.cast()?;
        core.SetMemoryUsageTargetLevel(memory_level(presence))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn background_hides_the_controller_and_lowers_the_memory_target() {
        assert!(!controller_visible(WebviewPresence::Background));
        assert_eq!(
            memory_level(WebviewPresence::Background),
            COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW
        );
    }

    #[test]
    fn foreground_restores_both() {
        assert!(controller_visible(WebviewPresence::Foreground));
        assert_eq!(
            memory_level(WebviewPresence::Foreground),
            COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL
        );
    }
}
