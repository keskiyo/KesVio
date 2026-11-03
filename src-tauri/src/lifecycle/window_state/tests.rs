use super::*;

#[test]
fn a_configured_minimum_is_converted_to_the_physical_pixels_a_geometry_is_stored_in() {
    assert_eq!(physical_minimum(Some(446.0), 1.0), 446);
    assert_eq!(physical_minimum(Some(446.0), 1.25), 558);
    assert_eq!(physical_minimum(Some(529.0), 1.5), 794);
}

#[test]
fn a_missing_or_impossible_minimum_clamps_nothing_away() {
    assert_eq!(physical_minimum(None, 1.0), 0);
    assert_eq!(physical_minimum(Some(0.0), 1.0), 0);
    assert_eq!(physical_minimum(Some(f64::NAN), 1.0), 0);
    assert_eq!(physical_minimum(Some(446.0), f64::NAN), 446);
    assert_eq!(physical_minimum(Some(446.0), 0.0), 446);
}

#[test]
fn the_window_configuration_declares_the_minimum_the_interface_is_built_for() {
    let config: serde_json::Value = serde_json::from_str(include_str!("../../../tauri.conf.json"))
        .expect("tauri.conf.json is valid JSON");
    let window = &config["app"]["windows"][0];

    assert_eq!(window["minWidth"].as_u64(), Some(446));
    assert_eq!(window["minHeight"].as_u64(), Some(529));
}
