use super::machine::Registrations;
use super::naming::normalized_portable_name;
use super::place::normalized_path as normalize;
use super::tree::{executable_path, publisher_of, referenced_executables};
use super::{AppInfo, ArtifactKind, LaunchKind, SourceKind, VisibilityClass, VisibilityReason};
use std::cmp::Reverse;
use std::collections::{HashMap, HashSet};
use std::path::Path;

const ARCHITECTURE_MARKERS: &[(&str, u8)] = &[
    ("arm64", 0),
    ("amd64", 3),
    ("win64", 3),
    ("win32", 1),
    ("x64", 3),
    ("x86", 1),
    ("x32", 1),
    ("a64", 0),
    ("64", 3),
    ("86", 1),
    ("32", 1),
];
const UNTAGGED_ARCHITECTURE: u8 = 2;

pub(super) fn reject_product_duplicates(apps: &mut [AppInfo], registrations: &Registrations) {
    let referenced = referenced_executables(apps);
    let mut groups: HashMap<ProductKey, Vec<(usize, Rank)>> = HashMap::new();
    for (index, app) in apps.iter().enumerate() {
        let Some(path) = executable_path(app) else {
            continue;
        };
        let Some(key) = product_key(app, path) else {
            continue;
        };
        let is_referenced =
            referenced.contains(&normalize(path)) || registrations.is_launchable(path);
        groups
            .entry(key)
            .or_default()
            .push((index, rank(app, path, is_referenced)));
    }
    let mut duplicates = HashSet::new();
    for members in groups.into_values().filter(|members| members.len() > 1) {
        let Some((kept, _)) = members.iter().max_by(|left, right| left.1.cmp(&right.1)) else {
            continue;
        };
        duplicates.extend(
            members
                .iter()
                .filter(|(index, rank)| index != kept && !rank.referenced)
                .map(|(index, _)| *index),
        );
    }
    for (index, app) in apps.iter_mut().enumerate() {
        if !duplicates.contains(&index) {
            continue;
        }
        app.visibility_class = VisibilityClass::Rejected;
        if !app
            .visibility_reasons
            .contains(&VisibilityReason::ProductDuplicate)
        {
            app.visibility_reasons
                .push(VisibilityReason::ProductDuplicate);
        }
    }
}

#[derive(Eq, Hash, PartialEq)]
struct ProductKey {
    name: String,
    publisher: String,
    version: String,
    unpublished_siblings: Option<(String, String)>,
}

fn product_key(app: &AppInfo, path: &str) -> Option<ProductKey> {
    if app.source_kind != SourceKind::Portable
        || app.launch_kind != LaunchKind::Executable
        || app.artifact_kind != ArtifactKind::Application
    {
        return None;
    }
    let version = app
        .version
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())?
        .to_lowercase();
    let name = normalized_portable_name(&app.name);
    if name.len() < 2 {
        return None;
    }
    let (publisher, unpublished_siblings) = match publisher_of(app) {
        Some(publisher) => (publisher, None),
        None => (String::new(), Some(architecture_siblings(path)?)),
    };
    Some(ProductKey {
        name,
        publisher,
        version,
        unpublished_siblings,
    })
}

fn architecture_siblings(path: &str) -> Option<(String, String)> {
    let path = Path::new(path);
    let directory = normalize(&path.parent()?.to_string_lossy());
    let (core, _) = split_architecture(&path.file_stem()?.to_string_lossy());
    Some((directory, core))
}

#[derive(Eq, Ord, PartialEq, PartialOrd)]
struct Rank {
    referenced: bool,
    primary: bool,
    names_product: bool,
    describes_product: bool,
    architecture: u8,
    shallowness: Reverse<usize>,
    brevity: Reverse<usize>,
    order: Reverse<String>,
}

fn rank(app: &AppInfo, path: &str, referenced: bool) -> Rank {
    let stem = Path::new(path)
        .file_stem()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_default();
    let (core, architecture) = split_architecture(&stem);
    Rank {
        referenced,
        primary: app.visibility_class == VisibilityClass::Primary,
        names_product: names_product(app, &core),
        describes_product: describes_product(app),
        architecture,
        shallowness: Reverse(Path::new(path).components().count()),
        brevity: Reverse(stem.chars().count()),
        order: Reverse(normalize(path)),
    }
}

fn product_names(app: &AppInfo) -> impl Iterator<Item = String> + '_ {
    [Some(app.name.as_str()), app.product_name.as_deref()]
        .into_iter()
        .flatten()
        .map(normalized_portable_name)
        .filter(|value| value.len() >= 2)
}

fn names_product(app: &AppInfo, core: &str) -> bool {
    let stem = normalized_portable_name(core);
    if stem.len() < 2 {
        return false;
    }
    product_names(app)
        .any(|product| product == stem || product.starts_with(&stem) || product.ends_with(&stem))
}

fn describes_product(app: &AppInfo) -> bool {
    let Some(description) = app.description.as_deref().map(normalized_portable_name) else {
        return false;
    };
    description.len() >= 2 && product_names(app).any(|product| product == description)
}

fn split_architecture(stem: &str) -> (String, u8) {
    let lowered = stem.to_lowercase();
    let stem = lowered
        .strip_suffix('a')
        .filter(|core| core.ends_with("64") || core.ends_with("32"))
        .unwrap_or(lowered.as_str());
    for (marker, preference) in ARCHITECTURE_MARKERS {
        let Some(core) = stem
            .strip_suffix(marker)
            .map(|core| core.trim_end_matches(['-', '_', ' ', '.']))
        else {
            continue;
        };
        if core.chars().count() >= 2 {
            return (core.to_owned(), *preference);
        }
    }
    (stem.to_owned(), UNTAGGED_ARCHITECTURE)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog::AppCategory;

    fn member(name: &str, path: &str) -> AppInfo {
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
            version: Some("2.51.2".into()),
            publisher: Some("The Git Development Community".into()),
            product_name: Some(name.into()),
            original_filename: None,
            install_location: None,
            can_uninstall: false,
            resolved_path: None,
            shortcut_icon_path: None,
            launch_arguments: None,
            canonical_identity: None,
            preference_identity: None,
            visibility_class: VisibilityClass::Auxiliary,
            visibility_score: 0,
            visibility_reasons: Vec::new(),
            target_availability: None,
            category_reasons: Vec::new(),
            close_risk: None,
            scan_folder: None,
            volume_id: None,
        }
    }

    fn described(name: &str, path: &str, description: &str) -> AppInfo {
        let mut app = member(name, path);
        app.description = Some(description.into());
        app.visibility_class = VisibilityClass::Primary;
        app
    }

    fn kept(apps: &[AppInfo]) -> Vec<&str> {
        apps.iter()
            .filter(|app| app.visibility_class != VisibilityClass::Rejected)
            .map(|app| app.path.as_str())
            .collect()
    }

    // Git for Windows stamps every helper with the product name, so the walk records thirty
    // rows called Git; the executable named after the product is the one row worth keeping.
    #[test]
    fn helpers_sharing_the_product_name_collapse_to_the_executable_named_after_it() {
        let mut apps = vec![
            member("Git", r"D:\Tools\Git\bin\bash.exe"),
            member("Git", r"D:\Tools\Git\bin\git.exe"),
            member("Git", r"D:\Tools\Git\cmd\git-receive-pack.exe"),
            member(
                "Git",
                r"D:\Tools\Git\mingw64\libexec\git-core\git-http-fetch.exe",
            ),
        ];

        reject_product_duplicates(&mut apps, &Registrations::empty());

        assert_eq!(kept(&apps), vec![r"D:\Tools\Git\bin\git.exe"]);
        assert!(apps[0]
            .visibility_reasons
            .contains(&VisibilityReason::ProductDuplicate));
        assert!(apps[1].visibility_reasons.is_empty());
    }

    // The rule runs after deduplication on purpose: dedup fills a record's missing version or
    // publisher from its siblings, so a group decided before it would not be the group a second
    // sanitize sees, and the catalog would keep changing under its own rules.
    #[test]
    fn the_sanitized_catalog_keeps_one_row_per_portable_product_and_stays_put() {
        let apps = vec![
            member("Git", r"D:\Tools\Git\bin\bash.exe"),
            member("Git", r"D:\Tools\Git\bin\git.exe"),
            member("Git", r"D:\Tools\Git\cmd\git-receive-pack.exe"),
            member("Git", r"D:\Tools\Git\mingw64\bin\git-http-fetch.exe"),
            member("Git LFS", r"D:\Tools\Git\mingw64\bin\git-lfs.exe"),
        ];
        let script = crate::platform::windows::NameScript::Latin;

        let once = crate::catalog::sanitize_pinned(apps, &Registrations::empty(), script);
        let twice = crate::catalog::sanitize_pinned(once.clone(), &Registrations::empty(), script);

        assert_eq!(
            once.iter().map(|app| app.path.as_str()).collect::<Vec<_>>(),
            vec![
                r"D:\Tools\Git\bin\git.exe",
                r"D:\Tools\Git\mingw64\bin\git-lfs.exe",
            ]
        );
        assert_eq!(
            twice
                .iter()
                .map(|app| app.path.as_str())
                .collect::<Vec<_>>(),
            once.iter().map(|app| app.path.as_str()).collect::<Vec<_>>()
        );
    }

    #[test]
    fn architecture_variants_keep_the_64_bit_build() {
        let mut apps = vec![
            described(
                "CrystalDiskInfo Aoi Edition",
                r"E:\Apps\CrystalDiskInfo\DiskInfo32A.exe",
                "CrystalDiskInfo Aoi Edition",
            ),
            described(
                "CrystalDiskInfo Aoi Edition",
                r"E:\Apps\CrystalDiskInfo\DiskInfoA64A.exe",
                "CrystalDiskInfo Aoi Edition",
            ),
            described(
                "CrystalDiskInfo Aoi Edition",
                r"E:\Apps\CrystalDiskInfo\DiskInfo64A.exe",
                "CrystalDiskInfo Aoi Edition",
            ),
            member("BGInfo", r"E:\Apps\BGInfo\Bginfo.exe"),
            member("BGInfo", r"E:\Apps\BGInfo\Bginfo64.exe"),
            member("Tk", r"E:\Apps\Tk\wish.exe"),
            member("Tk", r"E:\Apps\Tk\wish86.exe"),
        ];

        reject_product_duplicates(&mut apps, &Registrations::empty());

        assert_eq!(
            kept(&apps),
            vec![
                r"E:\Apps\CrystalDiskInfo\DiskInfo64A.exe",
                r"E:\Apps\BGInfo\Bginfo64.exe",
                r"E:\Apps\Tk\wish.exe",
            ]
        );
    }

    // Without a publisher a shared name proves nothing on its own, but two builds side by
    // side whose stems differ only by the architecture marker are one program twice.
    #[test]
    fn unpublished_architecture_siblings_in_one_folder_collapse_but_strangers_do_not() {
        let mut apps = vec![
            member("EncoderServer", r"D:\Apps\RTSS\EncoderServer.exe"),
            member("EncoderServer", r"D:\Apps\RTSS\EncoderServer64.exe"),
            member("EncoderServer", r"D:\Other\EncoderServer.exe"),
            member("EncoderServer", r"D:\Apps\RTSS\EncoderServerHelper.exe"),
        ];
        for app in &mut apps {
            app.publisher = None;
        }

        reject_product_duplicates(&mut apps, &Registrations::empty());

        assert_eq!(
            kept(&apps),
            vec![
                r"D:\Apps\RTSS\EncoderServer64.exe",
                r"D:\Other\EncoderServer.exe",
                r"D:\Apps\RTSS\EncoderServerHelper.exe",
            ]
        );
    }

    #[test]
    fn the_executable_described_as_the_product_outranks_its_helpers() {
        let mut apps = vec![
            described(
                "Hard Disk Sentinel",
                r"E:\Apps\hdsentinel\hdsaction.exe",
                "Hard Disk Sentinel Project Engine",
            ),
            described(
                "Hard Disk Sentinel",
                r"E:\Apps\hdsentinel\hdsctrl.exe",
                "Hard Disk Sentinel Control",
            ),
            described(
                "Hard Disk Sentinel",
                r"E:\Apps\hdsentinel\HDSentinel.exe",
                "Hard Disk Sentinel",
            ),
        ];

        reject_product_duplicates(&mut apps, &Registrations::empty());

        assert_eq!(kept(&apps), vec![r"E:\Apps\hdsentinel\HDSentinel.exe"]);
    }

    // A shortcut points at one build on purpose; the catalog keeps that one even when another
    // variant would rank higher on its own, and a second referenced build stays as well.
    #[test]
    fn a_referenced_executable_is_never_rejected() {
        let mut shortcut = member("CrystalDiskMark", r"C:\Menu\CrystalDiskMark.lnk");
        shortcut.source_kind = SourceKind::StartMenu;
        shortcut.launch_kind = LaunchKind::Shortcut;
        shortcut.resolved_path = Some(r"E:\Apps\CrystalDiskMark\DiskMark32.exe".into());
        let mut apps = vec![
            shortcut,
            member("CrystalDiskMark", r"E:\Apps\CrystalDiskMark\DiskMark32.exe"),
            member("CrystalDiskMark", r"E:\Apps\CrystalDiskMark\DiskMark64.exe"),
            member(
                "CrystalDiskMark",
                r"E:\Apps\CrystalDiskMark\DiskMarkA64.exe",
            ),
        ];

        reject_product_duplicates(&mut apps, &Registrations::empty());

        assert_eq!(
            kept(&apps),
            vec![
                r"C:\Menu\CrystalDiskMark.lnk",
                r"E:\Apps\CrystalDiskMark\DiskMark32.exe",
            ]
        );

        let mut apps = vec![
            member("CrystalDiskMark", r"E:\Apps\CrystalDiskMark\DiskMark32.exe"),
            member("CrystalDiskMark", r"E:\Apps\CrystalDiskMark\DiskMark64.exe"),
        ];
        let registrations = Registrations::from_paths(
            vec![r"E:\Apps\CrystalDiskMark\DiskMark32.exe".into()],
            Vec::new(),
        );

        reject_product_duplicates(&mut apps, &registrations);

        assert_eq!(kept(&apps), vec![r"E:\Apps\CrystalDiskMark\DiskMark32.exe"]);
    }

    #[test]
    fn a_primary_build_outranks_an_auxiliary_one_with_a_better_name() {
        let mut primary = member("Visual Studio", r"C:\VS\Installer\vs_installershell.exe");
        primary.visibility_class = VisibilityClass::Primary;
        let mut apps = vec![
            member("Visual Studio", r"C:\VS\Installer\vs_installer.exe"),
            primary,
        ];

        reject_product_duplicates(&mut apps, &Registrations::empty());

        assert_eq!(kept(&apps), vec![r"C:\VS\Installer\vs_installershell.exe"]);
    }

    // Two versions are two products the user may want side by side, a name without a
    // publisher or a version is no evidence of sameness, and installers are files rather than
    // product trees: two setups with one product name can be two different downloads.
    #[test]
    fn different_versions_publishers_installers_and_unversioned_names_are_kept() {
        let mut old = member("Rufus", r"E:\Tools\rufus-3.11p.exe");
        old.version = Some("3.11.0".into());
        let mut current = member("Rufus", r"D:\Tools\rufus-4.11p.exe");
        current.version = Some("4.11.2285".into());
        let mut alpha = member("Studio", r"C:\Alpha\Studio.exe");
        alpha.publisher = Some("Alpha".into());
        let mut beta = member("Studio", r"C:\Beta\Studio.exe");
        beta.publisher = Some("Beta".into());
        let mut first_setup = member("Attack Shark Software", r"D:\Downloads\X11 SOFT.exe");
        first_setup.artifact_kind = ArtifactKind::Installer;
        let mut second_setup = member("Attack Shark Software", r"D:\Downloads\X11SE SOFT.exe");
        second_setup.artifact_kind = ArtifactKind::Installer;
        let mut unpublished = member("tool", r"D:\A\tool.exe");
        unpublished.publisher = None;
        let mut also_unpublished = member("tool", r"D:\B\tool.exe");
        also_unpublished.publisher = None;
        let mut unversioned = member("tool", r"D:\C\tool.exe");
        unversioned.version = None;
        let mut also_unversioned = member("tool", r"D:\D\tool.exe");
        also_unversioned.version = None;
        let mut apps = vec![
            old,
            current,
            alpha,
            beta,
            first_setup,
            second_setup,
            unpublished,
            also_unpublished,
            unversioned,
            also_unversioned,
        ];

        reject_product_duplicates(&mut apps, &Registrations::empty());

        assert_eq!(kept(&apps).len(), 10);
    }

    #[test]
    fn the_architecture_marker_is_read_off_the_stem_and_leaves_the_name_behind() {
        assert_eq!(split_architecture("DiskInfo64A"), ("diskinfo".into(), 3));
        assert_eq!(split_architecture("DiskInfo32A"), ("diskinfo".into(), 1));
        assert_eq!(split_architecture("DiskInfoA64A"), ("diskinfo".into(), 0));
        assert_eq!(split_architecture("DiskMarkA64"), ("diskmark".into(), 0));
        assert_eq!(split_architecture("gpushark_x64"), ("gpushark".into(), 3));
        assert_eq!(split_architecture("WinMTR-x86"), ("winmtr".into(), 1));
        assert_eq!(split_architecture("wish86"), ("wish".into(), 1));
        assert_eq!(split_architecture("wish"), ("wish".into(), 2));
        assert_eq!(split_architecture("Bginfo64"), ("bginfo".into(), 3));
        assert_eq!(split_architecture("x64"), ("x64".into(), 2));
    }
}
