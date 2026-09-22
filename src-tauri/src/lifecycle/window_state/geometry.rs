use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub(crate) struct MinimumSize {
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WindowGeometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    #[serde(default)]
    pub maximized: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct ScreenRect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

fn overlap_area(geometry: &WindowGeometry, screen: &ScreenRect) -> u64 {
    let left = geometry.x.max(screen.x);
    let top = geometry.y.max(screen.y);
    let right = geometry
        .x
        .saturating_add(geometry.width as i32)
        .min(screen.x.saturating_add(screen.width as i32));
    let bottom = geometry
        .y
        .saturating_add(geometry.height as i32)
        .min(screen.y.saturating_add(screen.height as i32));
    if right <= left || bottom <= top {
        return 0;
    }
    u64::from(right.abs_diff(left)) * u64::from(bottom.abs_diff(top))
}

pub(crate) fn fit_to_screens(
    geometry: WindowGeometry,
    screens: &[ScreenRect],
    minimum: MinimumSize,
) -> Option<WindowGeometry> {
    let mut fitted = geometry;
    fitted.width = fitted.width.max(minimum.width);
    fitted.height = fitted.height.max(minimum.height);
    let home = screens
        .iter()
        .max_by_key(|screen| overlap_area(&fitted, screen))?;
    if overlap_area(&fitted, home) == 0 {
        return None;
    }
    fitted.width = fitted.width.min(home.width);
    fitted.height = fitted.height.min(home.height);
    let rightmost = home
        .x
        .saturating_add(home.width as i32)
        .saturating_sub(fitted.width as i32);
    let lowest = home
        .y
        .saturating_add(home.height as i32)
        .saturating_sub(fitted.height as i32);
    fitted.x = fitted.x.clamp(home.x, rightmost.max(home.x));
    fitted.y = fitted.y.clamp(home.y, lowest.max(home.y));
    Some(fitted)
}

pub(super) fn merged_geometry(
    previous: Option<WindowGeometry>,
    minimized: bool,
    maximized: bool,
    current: WindowGeometry,
) -> Option<WindowGeometry> {
    if minimized {
        return previous;
    }
    if maximized {
        if let Some(previous) = previous {
            return Some(WindowGeometry {
                maximized: true,
                ..previous
            });
        }
    }
    Some(WindowGeometry {
        maximized,
        ..current
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn geometry(x: i32, y: i32, width: u32, height: u32) -> WindowGeometry {
        WindowGeometry {
            x,
            y,
            width,
            height,
            maximized: false,
        }
    }

    fn primary() -> ScreenRect {
        ScreenRect {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        }
    }

    fn minimum() -> MinimumSize {
        MinimumSize {
            width: 446,
            height: 529,
        }
    }

    #[test]
    fn a_geometry_inside_a_monitor_is_kept_unchanged() {
        let saved = geometry(200, 150, 1250, 720);

        assert_eq!(fit_to_screens(saved, &[primary()], minimum()), Some(saved));
    }

    #[test]
    fn a_window_from_a_disconnected_monitor_is_rejected() {
        let saved = geometry(3000, 200, 1250, 720);

        assert_eq!(fit_to_screens(saved, &[primary()], minimum()), None);
        assert_eq!(fit_to_screens(saved, &[], minimum()), None);
    }

    #[test]
    fn a_window_hanging_off_the_edge_is_pulled_back_onto_its_monitor() {
        let saved = geometry(1800, 1000, 1250, 720);

        let fitted =
            fit_to_screens(saved, &[primary()], minimum()).expect("a sliver still overlaps");

        assert_eq!(fitted.x, 1920 - 1250);
        assert_eq!(fitted.y, 1080 - 720);
        assert_eq!((fitted.width, fitted.height), (1250, 720));
    }

    #[test]
    fn a_window_larger_than_its_monitor_is_clamped_to_it() {
        let saved = geometry(-40, -30, 3000, 2000);

        let fitted = fit_to_screens(saved, &[primary()], minimum())
            .expect("the window overlaps the monitor");

        assert_eq!((fitted.x, fitted.y), (0, 0));
        assert_eq!((fitted.width, fitted.height), (1920, 1080));
    }

    #[test]
    fn a_geometry_below_the_minimum_size_grows_to_it() {
        let saved = geometry(10, 10, 120, 90);

        let fitted = fit_to_screens(saved, &[primary()], minimum())
            .expect("the window overlaps the monitor");

        assert_eq!(
            (fitted.width, fitted.height),
            (minimum().width, minimum().height)
        );
    }

    #[test]
    fn a_secondary_monitor_keeps_its_own_window() {
        let secondary = ScreenRect {
            x: -1600,
            y: 120,
            width: 1600,
            height: 900,
        };
        let saved = geometry(-1400, 200, 1250, 720);

        assert_eq!(
            fit_to_screens(saved, &[primary(), secondary], minimum()),
            Some(saved)
        );
    }

    #[test]
    fn maximizing_keeps_the_restore_rectangle_instead_of_the_full_screen_one() {
        let restored = geometry(200, 150, 1250, 720);
        let full_screen = geometry(0, 0, 1920, 1080);

        let merged = merged_geometry(Some(restored), false, true, full_screen);

        assert_eq!(
            merged,
            Some(WindowGeometry {
                maximized: true,
                ..restored
            })
        );
    }

    #[test]
    fn minimizing_keeps_the_last_known_geometry() {
        let restored = geometry(200, 150, 1250, 720);
        let off_screen = geometry(-32000, -32000, 1250, 720);

        assert_eq!(
            merged_geometry(Some(restored), true, false, off_screen),
            Some(restored)
        );
        assert_eq!(merged_geometry(None, true, false, off_screen), None);
    }

    #[test]
    fn a_first_maximize_without_history_still_records_a_geometry() {
        let full_screen = geometry(0, 0, 1920, 1080);

        assert_eq!(
            merged_geometry(None, false, true, full_screen),
            Some(WindowGeometry {
                maximized: true,
                ..full_screen
            })
        );
    }

    #[test]
    fn the_maximized_flag_survives_fitting() {
        let saved = WindowGeometry {
            maximized: true,
            ..geometry(200, 150, 1250, 720)
        };

        assert_eq!(
            fit_to_screens(saved, &[primary()], minimum()).map(|fitted| fitted.maximized),
            Some(true)
        );
    }
}
