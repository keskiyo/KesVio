use super::machine::Registrations;
use super::place::normalized_path as normalize;
use super::{AppInfo, LaunchKind, SourceKind, VisibilityClass, VisibilityReason};
use std::collections::{HashMap, HashSet};
use std::path::Path;

pub(super) fn demote_nested_components(apps: &mut [AppInfo], registrations: &Registrations) {
    let anchors = publishers_by_directory(apps);
    let referenced = referenced_executables(apps);

    for app in apps.iter_mut() {
        if app.source_kind != SourceKind::Portable || app.launch_kind == LaunchKind::AppUserModelId
        {
            continue;
        }
        let (Some(path), Some(publisher)) = (executable_path(app), publisher_of(app)) else {
            continue;
        };
        if referenced.contains(&normalize(path))
            || registrations.is_launchable(path)
            || names_its_own_folder(path)
        {
            continue;
        }
        if !has_ancestor_from_the_same_publisher(path, &publisher, &anchors) {
            continue;
        }
        app.visibility_class = VisibilityClass::Auxiliary;
        if !app
            .visibility_reasons
            .contains(&VisibilityReason::ProductComponent)
        {
            app.visibility_reasons
                .push(VisibilityReason::ProductComponent);
        }
    }
}

pub(super) fn demote_sibling_companions(apps: &mut [AppInfo]) {
    let product_folders = registered_product_folders(apps);
    if product_folders.is_empty() {
        return;
    }
    let referenced = referenced_executables(apps);

    for app in apps.iter_mut() {
        if app.source_kind != SourceKind::Portable
            || app.launch_kind == LaunchKind::AppUserModelId
            || app.visibility_class != VisibilityClass::Primary
        {
            continue;
        }
        let Some(path) = executable_path(app) else {
            continue;
        };
        if referenced.contains(&normalize(path)) {
            continue;
        }
        let Some(directory) = Path::new(path).parent() else {
            continue;
        };
        if !product_folders.contains(&normalize(&directory.to_string_lossy())) {
            continue;
        }
        app.visibility_class = VisibilityClass::Auxiliary;
        if !app
            .visibility_reasons
            .contains(&VisibilityReason::ProductComponent)
        {
            app.visibility_reasons
                .push(VisibilityReason::ProductComponent);
        }
    }
}

fn registered_product_folders(apps: &[AppInfo]) -> HashSet<String> {
    let mut folders = HashSet::new();
    for app in apps {
        if app.source_kind == SourceKind::Portable {
            continue;
        }
        let Some(target) = app.resolved_path.as_deref().map(str::trim) else {
            continue;
        };
        let Some(directory) = Path::new(target).parent() else {
            continue;
        };
        let Some(folder) = directory.file_name().map(|value| value.to_string_lossy()) else {
            continue;
        };
        if folder_names_product(&folder, app) {
            folders.insert(normalize(&directory.to_string_lossy()));
        }
    }
    folders
}

fn folder_names_product(folder: &str, app: &AppInfo) -> bool {
    let folder = super::naming::normalized_portable_name(folder);
    if folder.len() < 3 {
        return false;
    }
    [Some(app.name.as_str()), app.product_name.as_deref()]
        .into_iter()
        .flatten()
        .map(super::naming::normalized_portable_name)
        .any(|product| {
            product.len() >= 3
                && (product == folder
                    || product.starts_with(&folder)
                    || folder.starts_with(&product))
        })
}

fn publishers_by_directory(apps: &[AppInfo]) -> HashMap<String, HashSet<String>> {
    let mut directories: HashMap<String, HashSet<String>> = HashMap::new();
    for app in apps {
        let (Some(path), Some(publisher)) = (executable_path(app), publisher_of(app)) else {
            continue;
        };
        let Some(directory) = Path::new(path).parent() else {
            continue;
        };
        let directory = normalize(&directory.to_string_lossy());
        if !directory.is_empty() {
            directories.entry(directory).or_default().insert(publisher);
        }
    }
    directories
}

fn publisher_of(app: &AppInfo) -> Option<String> {
    app.publisher
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_lowercase)
}

fn referenced_executables(apps: &[AppInfo]) -> HashSet<String> {
    let mut referenced = HashSet::new();
    for app in apps {
        if let Some(target) = app.resolved_path.as_deref() {
            referenced.insert(normalize(target));
        }
        if app.source_kind != SourceKind::Portable {
            referenced.insert(normalize(&app.path));
        }
    }
    referenced
}

fn names_its_own_folder(path: &str) -> bool {
    let path = Path::new(path);
    let Some(stem) = path.file_stem().map(|value| value.to_string_lossy()) else {
        return false;
    };
    let stem = without_architecture_suffix(&stem);
    path.parent()
        .and_then(Path::file_name)
        .map(|folder| folder.to_string_lossy())
        .is_some_and(|folder| {
            super::naming::normalized_portable_name(&folder)
                == super::naming::normalized_portable_name(&stem)
        })
}

fn without_architecture_suffix(stem: &str) -> String {
    let mut tokens = stem
        .split(|character: char| !character.is_alphanumeric())
        .filter(|token| !token.is_empty())
        .collect::<Vec<_>>();
    while tokens.len() > 1
        && tokens.last().is_some_and(|token| {
            matches!(
                token.to_lowercase().as_str(),
                "x64" | "x86" | "x32" | "64" | "32" | "win64" | "win32" | "amd64" | "arm64"
            )
        })
    {
        tokens.pop();
    }
    tokens.join(" ")
}

fn has_ancestor_from_the_same_publisher(
    path: &str,
    publisher: &str,
    anchors: &HashMap<String, HashSet<String>>,
) -> bool {
    Path::new(path)
        .parent()
        .into_iter()
        .flat_map(|directory| directory.ancestors().skip(1))
        .filter_map(|ancestor| anchors.get(&normalize(&ancestor.to_string_lossy())))
        .any(|publishers| publishers.contains(publisher))
}

fn executable_path(app: &AppInfo) -> Option<&str> {
    [app.resolved_path.as_deref(), Some(app.path.as_str())]
        .into_iter()
        .flatten()
        .map(str::trim)
        .find(|value| {
            Path::new(value)
                .extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("exe"))
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog::{AppCategory, ArtifactKind};

    fn published(name: &str, path: &str, publisher: &str) -> AppInfo {
        let mut app = portable(name, path);
        app.publisher = Some(publisher.into());
        app
    }

    fn portable(name: &str, path: &str) -> AppInfo {
        AppInfo {
            id: path.into(),
            name: name.into(),
            path: path.into(),
            icon_base64: None,
            artifact_kind: ArtifactKind::Application,
            category: AppCategory::Other,
            launch_kind: LaunchKind::Executable,
            source_kind: SourceKind::Portable,
            description: None,
            version: None,
            publisher: None,
            product_name: None,
            original_filename: None,
            install_location: None,
            can_uninstall: false,
            resolved_path: None,
            shortcut_icon_path: None,
            launch_arguments: None,
            canonical_identity: None,
            preference_identity: None,
            visibility_class: VisibilityClass::Primary,
            visibility_score: 0,
            visibility_reasons: Vec::new(),
            target_availability: None,
            category_reasons: Vec::new(),
            close_risk: None,
            scan_folder: None,
        }
    }

    fn classes(apps: &[AppInfo]) -> Vec<(&str, VisibilityClass)> {
        apps.iter()
            .map(|app| (app.name.as_str(), app.visibility_class))
            .collect()
    }

    #[test]
    fn nested_executables_below_a_products_own_folder_are_components() {
        let mut apps = vec![
            published(
                "CrystalDiskInfo",
                r"E:\Програмки\SSD&HDD\CrystalDiskInfo9_7_1Aoi\DiskInfo64A.exe",
                "Crystal Dew World",
            ),
            published(
                "AlertMail48",
                r"E:\Програмки\SSD&HDD\CrystalDiskInfo9_7_1Aoi\CdiResource\AlertMail48.exe",
                "Crystal Dew World",
            ),
            published(
                "Setup",
                r"E:\Програмки\Office\MICROSOFT.OFFICE.2007\SETUP.EXE",
                "Microsoft Corporation",
            ),
            published(
                "OSE",
                r"E:\Програмки\Office\MICROSOFT.OFFICE.2007\ENTERPRISE.WW\OSE.EXE",
                "Microsoft Corporation",
            ),
            published(
                "DWTRIG20",
                r"E:\Програмки\Office\MICROSOFT.OFFICE.2007\OFFICE.RU-RU\DWTRIG20.EXE",
                "Microsoft Corporation",
            ),
        ];

        demote_nested_components(&mut apps, &Registrations::empty());

        assert_eq!(
            classes(&apps),
            vec![
                ("CrystalDiskInfo", VisibilityClass::Primary),
                ("AlertMail48", VisibilityClass::Auxiliary),
                ("Setup", VisibilityClass::Primary),
                ("OSE", VisibilityClass::Auxiliary),
                ("DWTRIG20", VisibilityClass::Auxiliary),
            ]
        );
        assert!(apps[1]
            .visibility_reasons
            .contains(&VisibilityReason::ProductComponent));
    }

    #[test]
    fn independent_applications_in_their_own_folders_are_kept() {
        let mut apps = vec![
            portable("Loose tool", r"D:\Portable\tool.exe"),
            portable("Notepad3", r"D:\Portable\Notepad3\Notepad3.exe"),
            portable("HxD", r"D:\Portable\HxD\HxD.exe"),
        ];

        demote_nested_components(&mut apps, &Registrations::empty());

        assert!(apps
            .iter()
            .all(|app| app.visibility_class == VisibilityClass::Primary));
    }

    #[test]
    fn a_different_vendors_application_in_a_subfolder_is_not_a_component() {
        let mut apps = vec![
            published(
                "OCCT",
                r"E:\Програмки\test system\OCCT 14.2.6 Portable.exe",
                "OCCT",
            ),
            published(
                "AIDA64 Extreme",
                r"E:\Програмки\test system\AIDA64 Extreme Edition 6.85.6305 Beta Portable\aida64.exe",
                "FinalWire Ltd.",
            ),
            published(
                "Windhawk",
                r"D:\разный хлам\Windhawk\windhawk.exe",
                "Ramen Software",
            ),
            published(
                "VSCodium",
                r"D:\разный хлам\Windhawk\UI\VSCodium.exe",
                "VSCodium",
            ),
        ];

        demote_nested_components(&mut apps, &Registrations::empty());

        assert_eq!(
            classes(&apps),
            vec![
                ("OCCT", VisibilityClass::Primary),
                ("AIDA64 Extreme", VisibilityClass::Primary),
                ("Windhawk", VisibilityClass::Primary),
                ("VSCodium", VisibilityClass::Primary),
            ]
        );
    }

    #[test]
    fn an_executable_naming_its_folder_with_an_architecture_suffix_is_kept() {
        let mut apps = vec![
            published(
                "FurMark(GUI)",
                r"D:\разный хлам\FurMark_2.10.2_win64\FurMark_win64\FurMark_GUI.exe",
                "Geeks3D",
            ),
            published(
                "gpushark",
                r"D:\разный хлам\FurMark_2.10.2_win64\FurMark_win64\gpushark\gpushark_x64.exe",
                "Geeks3D",
            ),
        ];

        demote_nested_components(&mut apps, &Registrations::empty());

        assert_eq!(apps[1].visibility_class, VisibilityClass::Primary);
    }

    #[test]
    fn an_architecture_suffix_is_only_dropped_as_a_whole_token() {
        assert_eq!(without_architecture_suffix("gpushark_x64"), "gpushark");
        assert_eq!(without_architecture_suffix("WinMTR-x86"), "WinMTR");
        assert_eq!(without_architecture_suffix("DiskInfo64A"), "DiskInfo64A");
        assert_eq!(without_architecture_suffix("AlertMail48"), "AlertMail48");
        assert_eq!(without_architecture_suffix("x64"), "x64");
    }

    #[test]
    fn an_executable_without_a_publisher_is_left_alone() {
        let mut apps = vec![
            published("Anchor", r"D:\Vendor\anchor.exe", "Vendor"),
            portable("Unknown", r"D:\Vendor\extras\unknown.exe"),
        ];

        demote_nested_components(&mut apps, &Registrations::empty());

        assert_eq!(apps[1].visibility_class, VisibilityClass::Primary);
    }

    #[test]
    fn a_referenced_executable_is_never_a_component() {
        let mut shortcut = portable(
            "Vendor App",
            r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Vendor App.lnk",
        );
        shortcut.source_kind = SourceKind::StartMenu;
        shortcut.launch_kind = LaunchKind::Shortcut;
        shortcut.resolved_path = Some(r"D:\Vendor\runtime\vendorapp.exe".into());

        let mut apps = vec![
            published("Vendor Launcher", r"D:\Vendor\launcher.exe", "Vendor Ltd"),
            published(
                "Vendor App",
                r"D:\Vendor\runtime\vendorapp.exe",
                "Vendor Ltd",
            ),
            shortcut,
        ];

        demote_nested_components(&mut apps, &Registrations::empty());

        assert_eq!(apps[1].visibility_class, VisibilityClass::Primary);
    }

    #[test]
    fn executables_sharing_one_directory_are_not_demoted() {
        let mut apps = vec![
            published("First", r"D:\Tools\first.exe", "Vendor Ltd"),
            published("Second", r"D:\Tools\second.exe", "Vendor Ltd"),
        ];

        demote_nested_components(&mut apps, &Registrations::empty());

        assert!(apps
            .iter()
            .all(|app| app.visibility_class == VisibilityClass::Primary));
    }

    fn registered(name: &str, shortcut: &str, target: &str) -> AppInfo {
        let mut app = portable(name, shortcut);
        app.source_kind = SourceKind::StartMenu;
        app.launch_kind = LaunchKind::Shortcut;
        app.resolved_path = Some(target.into());
        app
    }

    #[test]
    fn unreferenced_siblings_of_a_registered_target_in_the_products_own_folder_are_components() {
        let mut apps = vec![
            registered(
                "RivaTuner Statistics Server",
                r"C:\Menu\RivaTuner Statistics Server.lnk",
                r"D:\Apps\RivaTuner Statistics Server\RTSS.exe",
            ),
            portable("RTSS", r"D:\Apps\RivaTuner Statistics Server\RTSS.exe"),
            portable(
                "EncoderServer",
                r"D:\Apps\RivaTuner Statistics Server\EncoderServer.exe",
            ),
            portable(
                "RTSSHooksLoader",
                r"D:\Apps\RivaTuner Statistics Server\RTSSHooksLoader.exe",
            ),
        ];

        demote_sibling_companions(&mut apps);

        assert_eq!(
            classes(&apps),
            vec![
                ("RivaTuner Statistics Server", VisibilityClass::Primary),
                ("RTSS", VisibilityClass::Primary),
                ("EncoderServer", VisibilityClass::Auxiliary),
                ("RTSSHooksLoader", VisibilityClass::Auxiliary),
            ]
        );
        assert!(apps[2]
            .visibility_reasons
            .contains(&VisibilityReason::ProductComponent));
    }

    #[test]
    fn a_shared_folder_that_names_no_product_demotes_nothing() {
        let mut apps = vec![
            registered(
                "TgWsProxy",
                r"C:\Menu\TgWsProxy.lnk",
                r"D:\Downloads\TgWsProxy_windows.exe",
            ),
            portable("Rufus", r"D:\Downloads\rufus-4.11p.exe"),
            portable("HxD", r"D:\Downloads\HxD.exe"),
        ];

        demote_sibling_companions(&mut apps);

        assert!(apps
            .iter()
            .all(|app| app.visibility_class == VisibilityClass::Primary));
    }

    #[test]
    fn a_companion_in_a_subfolder_is_outside_the_sibling_rule() {
        let mut apps = vec![
            registered(
                "FurMark",
                r"C:\Menu\FurMark.lnk",
                r"D:\Apps\FurMark\FurMark_GUI.exe",
            ),
            portable("GPU-Z", r"D:\Apps\FurMark\gpuz\gpuz.exe"),
        ];

        demote_sibling_companions(&mut apps);

        assert_eq!(apps[1].visibility_class, VisibilityClass::Primary);
    }

    #[test]
    fn a_sibling_already_auxiliary_or_registered_is_left_as_it_is() {
        let mut console = portable("rtss-cli", r"D:\Apps\RivaTuner Statistics Server\cli.exe");
        console.visibility_class = VisibilityClass::Auxiliary;
        console
            .visibility_reasons
            .push(VisibilityReason::ConsoleApplication);
        let mut apps = vec![
            registered(
                "RivaTuner Statistics Server",
                r"C:\Menu\RivaTuner Statistics Server.lnk",
                r"D:\Apps\RivaTuner Statistics Server\RTSS.exe",
            ),
            console,
        ];

        demote_sibling_companions(&mut apps);

        assert_eq!(
            apps[1].visibility_reasons,
            vec![VisibilityReason::ConsoleApplication]
        );
    }

    #[test]
    fn a_folder_matches_the_product_by_name_or_product_name_without_a_version() {
        let mut app = registered("Python 3.13 (64-bit)", r"C:\Menu\Python.lnk", "");
        app.product_name = Some("Python".into());
        assert!(folder_names_product("Python313", &app));
        assert!(folder_names_product("python-3.13.0", &app));
        assert!(!folder_names_product("Downloads", &app));
        assert!(!folder_names_product("Py", &app));
    }
}
