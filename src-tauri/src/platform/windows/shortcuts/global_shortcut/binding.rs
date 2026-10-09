use serde::{Deserialize, Serialize};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    HOT_KEY_MODIFIERS, MOD_ALT, MOD_CONTROL, MOD_NOREPEAT, MOD_SHIFT, MOD_WIN,
};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Binding {
    pub(crate) win: bool,
    pub(crate) ctrl: bool,
    pub(crate) alt: bool,
    pub(crate) shift: bool,
    pub(crate) key: String,
}

impl Default for Binding {
    fn default() -> Self {
        Self {
            win: true,
            ctrl: false,
            alt: false,
            shift: true,
            key: "KeyQ".into(),
        }
    }
}

impl Binding {
    pub(crate) fn validate(&self) -> Result<(), ()> {
        if !self.win && !self.ctrl && !self.alt {
            return Err(());
        }
        self.virtual_key()?;
        if self.reserved() {
            return Err(());
        }
        Ok(())
    }

    pub(crate) fn label(&self) -> Result<String, ()> {
        self.validate()?;
        let mut parts = Vec::new();
        if self.win {
            parts.push("Win".to_owned());
        }
        if self.ctrl {
            parts.push("Ctrl".to_owned());
        }
        if self.alt {
            parts.push("Alt".to_owned());
        }
        if self.shift {
            parts.push("Shift".to_owned());
        }
        parts.push(self.key_label()?);
        Ok(parts.join("+"))
    }

    pub(crate) fn modifiers(&self) -> Result<HOT_KEY_MODIFIERS, ()> {
        self.validate()?;
        let mut modifiers = MOD_NOREPEAT;
        if self.win {
            modifiers |= MOD_WIN;
        }
        if self.ctrl {
            modifiers |= MOD_CONTROL;
        }
        if self.alt {
            modifiers |= MOD_ALT;
        }
        if self.shift {
            modifiers |= MOD_SHIFT;
        }
        Ok(modifiers)
    }

    pub(crate) fn virtual_key(&self) -> Result<u32, ()> {
        self.key_parts()
            .map(|(_, virtual_key)| virtual_key)
            .ok_or(())
    }

    fn key_label(&self) -> Result<String, ()> {
        self.key_parts().map(|(label, _)| label).ok_or(())
    }

    fn key_parts(&self) -> Option<(String, u32)> {
        if self.key.len() > 7 {
            return None;
        }
        if let Some(value) = self.key.strip_prefix("Key") {
            let mut chars = value.chars();
            let letter = chars.next()?;
            if chars.next().is_none() && letter.is_ascii_uppercase() {
                return Some((letter.to_string(), letter as u32));
            }
        }
        if let Some(value) = self.key.strip_prefix("Digit") {
            let mut chars = value.chars();
            let digit = chars.next()?;
            if chars.next().is_none() && digit.is_ascii_digit() {
                return Some((digit.to_string(), digit as u32));
            }
        }
        let number = self.key.strip_prefix('F')?.parse::<u32>().ok()?;
        (1..=12)
            .contains(&number)
            .then(|| (format!("F{number}"), 0x70 + number - 1))
    }

    fn reserved(&self) -> bool {
        !self.win
            && self.ctrl
            && !self.alt
            && matches!(
                (self.shift, self.key.as_str()),
                (false, "KeyF") | (false, "KeyK") | (true, "KeyK")
            )
    }
}

#[cfg(test)]
#[path = "binding_tests.rs"]
mod tests;
