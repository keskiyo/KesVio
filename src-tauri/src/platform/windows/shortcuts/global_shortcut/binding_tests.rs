use super::*;

#[test]
fn labels_a_valid_physical_key_binding() {
    let binding = Binding {
        win: true,
        ctrl: true,
        alt: false,
        shift: true,
        key: "KeyP".into(),
    };

    assert_eq!(binding.label().unwrap(), "Win+Ctrl+Shift+P");
    assert_eq!(binding.virtual_key().unwrap(), u32::from(b'P'));
}

#[test]
fn accepts_letters_digits_and_function_keys() {
    for (key, virtual_key) in [("KeyA", 0x41), ("Digit7", 0x37), ("F12", 0x7B)] {
        let binding = Binding {
            win: true,
            ctrl: false,
            alt: false,
            shift: false,
            key: key.into(),
        };

        assert_eq!(binding.virtual_key().unwrap(), virtual_key);
    }
}

#[test]
fn rejects_unmodified_shift_only_and_unsupported_keys() {
    for binding in [
        Binding {
            win: false,
            ctrl: false,
            alt: false,
            shift: false,
            key: "KeyA".into(),
        },
        Binding {
            win: false,
            ctrl: false,
            alt: false,
            shift: true,
            key: "KeyA".into(),
        },
        Binding {
            win: true,
            ctrl: false,
            alt: false,
            shift: false,
            key: "Space".into(),
        },
    ] {
        assert!(binding.validate().is_err());
    }
}

#[test]
fn reserves_the_fixed_in_app_shortcuts() {
    for binding in [
        Binding {
            win: false,
            ctrl: true,
            alt: false,
            shift: false,
            key: "KeyF".into(),
        },
        Binding {
            win: false,
            ctrl: true,
            alt: false,
            shift: false,
            key: "KeyK".into(),
        },
        Binding {
            win: false,
            ctrl: true,
            alt: false,
            shift: true,
            key: "KeyK".into(),
        },
    ] {
        assert!(binding.validate().is_err());
    }
}
