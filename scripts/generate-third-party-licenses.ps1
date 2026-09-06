<#
Generates THIRD_PARTY_LICENSES.txt: the license texts that must travel with the installer.

THIRD_PARTY_NOTICES.md is an inventory of what is distributed. This file is the obligation itself -
MIT, BSD, ISC, Apache-2.0 and Unicode-3.0 all require the text and the copyright notice to reach
whoever receives the binary, and MPL-2.0 3.2 requires telling that recipient how to obtain source.

The inventory is derived from the manifests, never hand-maintained, so a lockfile change cannot
leave it stale. Text comes from what upstream actually ships; the small set of packages that ship
no license file at all falls back to the canonical text in scripts/license-texts, and a package
with neither fails the run rather than being emitted without a license.

Identical texts are emitted once and referenced by id, which keeps ~200 Apache-2.0 dependencies
from writing the same 9 KB block 200 times.
#>
param(
  [string]$OutputPath
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputPath) {
  $OutputPath = Join-Path $repoRoot "THIRD_PARTY_LICENSES.txt"
}
$canonicalRoot = Join-Path $PSScriptRoot "license-texts"

$licenseFilePattern = '^(LICEN[SC]E|COPYING|COPYRIGHT|UNLICENSE|NOTICE)'
# An SPDX document describes the licensing, it is not the license grant, so it never counts as text.
$licenseFileExclusion = '\.spdx$'
# Order decides which canonical text a dual-licensed package without files falls back to.
$canonicalPreference = @('MIT', 'Apache-2.0', 'BSD-3-Clause', 'MPL-2.0')

function Get-LicenseTexts([string]$directory) {
  if (-not (Test-Path -LiteralPath $directory)) {
    return @()
  }
  Get-ChildItem -LiteralPath $directory -File |
    Where-Object { $_.Name -match $licenseFilePattern -and $_.Name -notmatch $licenseFileExclusion } |
    Sort-Object Name |
    ForEach-Object {
      [pscustomobject]@{
        FileName = $_.Name
        Text     = ([IO.File]::ReadAllText($_.FullName) -replace "`r`n", "`n").TrimEnd()
      }
    }
}

function Get-CanonicalText([string]$spdx) {
  foreach ($candidate in $canonicalPreference) {
    if ($spdx -match [regex]::Escape($candidate)) {
      $path = Join-Path $canonicalRoot "$candidate.txt"
      if (Test-Path -LiteralPath $path) {
        return [pscustomobject]@{
          FileName = "$candidate.txt"
          Text     = ([IO.File]::ReadAllText($path) -replace "`r`n", "`n").TrimEnd()
        }
      }
    }
  }
  return $null
}

function Read-NpmPackages {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $listing = (& npm ls --omit=dev --all --json --prefix $repoRoot) -join "`n"
  $ErrorActionPreference = $previous
  if (-not $listing.Trim()) {
    throw "npm ls produced no output"
  }
  $tree = $listing | ConvertFrom-Json

  $flat = [ordered]@{}
  $pending = New-Object System.Collections.Generic.Queue[object]
  $pending.Enqueue($tree)
  while ($pending.Count -gt 0) {
    $node = $pending.Dequeue()
    if (-not $node -or -not ($node.PSObject.Properties.Name -contains 'dependencies')) {
      continue
    }
    foreach ($entry in $node.dependencies.PSObject.Properties) {
      # An entry without a resolved version is an unmet optional peer. It is not installed and not
      # distributed, so it carries no notice obligation.
      if (-not "$($entry.Value.version)".Trim()) {
        continue
      }
      $flat["$($entry.Name)@$($entry.Value.version)"] = $entry
      $pending.Enqueue($entry.Value)
    }
  }

  $packages = New-Object System.Collections.Generic.List[object]
  foreach ($key in $flat.Keys) {
    $entry = $flat[$key]
    $directory = Join-Path $repoRoot "node_modules/$($entry.Name)"
    $manifestPath = Join-Path $directory "package.json"
    $spdx = "UNKNOWN"
    $source = "https://www.npmjs.com/package/$($entry.Name)/v/$($entry.Value.version)"
    if (Test-Path -LiteralPath $manifestPath) {
      $manifest = [IO.File]::ReadAllText($manifestPath) | ConvertFrom-Json
      if ("$($manifest.license)".Trim()) {
        $spdx = "$($manifest.license)"
      }
      if ($manifest.repository -and "$($manifest.repository.url)".Trim()) {
        $source = ("$($manifest.repository.url)" -replace '^git\+', '') -replace '\.git$', ''
      }
    }
    $packages.Add([pscustomobject]@{
        Ecosystem = "npm"
        Name      = $entry.Name
        Version   = "$($entry.Value.version)"
        Spdx      = $spdx
        Source    = $source
        Texts     = @(Get-LicenseTexts $directory)
      })
  }
  , ($packages | Sort-Object Name, Version)
}

function Get-CargoRegistryRoots {
  $cargoHome = $env:CARGO_HOME
  if (-not "$cargoHome".Trim()) {
    $cargoHome = Join-Path $env:USERPROFILE ".cargo"
  }
  $sources = Join-Path $cargoHome "registry/src"
  if (-not (Test-Path -LiteralPath $sources)) {
    throw "Cargo registry sources not found at $sources; run a cargo build first"
  }
  @(Get-ChildItem -LiteralPath $sources -Directory)
}

function Read-CargoPackages {
  $manifest = Join-Path $repoRoot "src-tauri/Cargo.toml"
  $lines = & cargo tree --manifest-path $manifest -e normal,build --target x86_64-pc-windows-msvc --prefix none --format "{p}|{l}|{r}"
  if ($LASTEXITCODE -ne 0) {
    throw "cargo tree failed with exit code $LASTEXITCODE"
  }
  $roots = Get-CargoRegistryRoots

  $packages = [ordered]@{}
  foreach ($line in $lines) {
    $fields = "$line" -split '\|'
    if ($fields.Count -lt 1 -or -not "$($fields[0])".Trim()) {
      continue
    }
    # `(*)` marks a subtree cargo already printed; `(D:\...)` marks this workspace's own crate.
    $descriptor = "$($fields[0])" -replace ' \(\*\)$', ''
    if ($descriptor -match '\s\([A-Za-z]:\\') {
      continue
    }
    $descriptor = $descriptor -replace ' \(proc-macro\)$', ''
    if ($descriptor -notmatch '^(?<name>\S+) v(?<version>\S+)$') {
      continue
    }
    $name = $Matches['name']
    $version = $Matches['version']
    $key = "$name-$version"
    if ($packages.Contains($key)) {
      continue
    }

    $spdx = "UNKNOWN"
    if ($fields.Count -ge 2 -and "$($fields[1])".Trim()) {
      $spdx = "$($fields[1])".Trim()
    }
    $source = "https://crates.io/crates/$name/$version"
    if ($fields.Count -ge 3 -and "$($fields[2])".Trim()) {
      $source = ("$($fields[2])".Trim() -replace '\.git$', '')
    }

    # An unpacked source directory with no license file is a real upstream fact and falls back to a
    # canonical text. No directory at all means the registry was never populated, which would make
    # every crate fall back at once and quietly replace the real notices; that is a hard failure.
    $texts = @()
    $unpacked = $false
    foreach ($root in $roots) {
      $directory = Join-Path $root.FullName $key
      if (-not (Test-Path -LiteralPath $directory)) {
        continue
      }
      $unpacked = $true
      $texts = @(Get-LicenseTexts $directory)
      if ($texts.Count -gt 0) {
        break
      }
    }
    if (-not $unpacked) {
      throw "Cargo registry has no unpacked source for $key; run 'cargo tree --manifest-path src-tauri/Cargo.toml' to populate it"
    }
    $packages[$key] = [pscustomobject]@{
      Ecosystem = "crates.io"
      Name      = $name
      Version   = $version
      Spdx      = $spdx
      Source    = $source
      Texts     = $texts
    }
  }
  , (@($packages.Values) | Sort-Object Name, Version)
}

$all = New-Object System.Collections.Generic.List[object]
foreach ($package in (Read-NpmPackages)) { $all.Add($package) }
foreach ($package in (Read-CargoPackages)) { $all.Add($package) }

$textIndex = [ordered]@{}
$textOrder = New-Object System.Collections.Generic.List[object]
$missing = New-Object System.Collections.Generic.List[string]
$sha = [Security.Cryptography.SHA256]::Create()

foreach ($package in $all) {
  $package | Add-Member -NotePropertyName TextIds -NotePropertyValue (New-Object System.Collections.Generic.List[int])
  $package | Add-Member -NotePropertyName Fallback -NotePropertyValue $false

  $texts = @($package.Texts)
  if ($texts.Count -eq 0) {
    $canonical = Get-CanonicalText $package.Spdx
    if (-not $canonical) {
      $missing.Add("$($package.Name) $($package.Version) ($($package.Ecosystem)) declares '$($package.Spdx)' but ships no license file and scripts/license-texts has no canonical text for it")
      continue
    }
    $texts = @($canonical)
    $package.Fallback = $true
  }

  foreach ($text in $texts) {
    $digest = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($text.Text)))
    if (-not $textIndex.Contains($digest)) {
      $record = [pscustomobject]@{
        Id       = $textOrder.Count + 1
        FileName = $text.FileName
        Origin   = "$($package.Name) $($package.Version)"
        Users    = 0
        Text     = $text.Text
      }
      $textIndex[$digest] = $record
      $textOrder.Add($record)
    }
    $record = $textIndex[$digest]
    $record.Users = $record.Users + 1
    $package.TextIds.Add($record.Id)
  }
}

if ($missing.Count -gt 0) {
  throw "Cannot generate third-party licenses:`n - $($missing -join "`n - ")"
}

$appVersion = ([IO.File]::ReadAllText((Join-Path $repoRoot "src-tauri/tauri.conf.json")) | ConvertFrom-Json).version
$mpl = @($all | Where-Object { $_.Spdx -match 'MPL-2\.0' } | Sort-Object Name)
$rule = '-' * 79

$out = New-Object System.Collections.Generic.List[string]
$out.Add("KesVio $appVersion - third-party licenses")
$out.Add("=" * 79)
$out.Add("")
$out.Add("KesVio is distributed under the MIT License; see LICENSE. It also distributes the")
$out.Add("third-party packages listed below. Section 1 names every package and points at the")
$out.Add("license text that applies to it. Section 2 holds those texts. A text shared by several")
$out.Add("packages is printed once and referenced by id.")
$out.Add("")
$out.Add("Generated by scripts/generate-third-party-licenses.ps1 from package.json and")
$out.Add("package-lock.json (npm runtime dependencies) and from src-tauri/Cargo.toml and")
$out.Add("src-tauri/Cargo.lock (Rust normal and build dependencies resolved for")
$out.Add("x86_64-pc-windows-msvc). Do not edit by hand.")
$out.Add("")
if ($mpl.Count -gt 0) {
  $out.Add("Mozilla Public License 2.0 - source availability")
  $out.Add($rule)
  $out.Add("")
  $out.Add("KesVio distributes the following packages in executable form under the MPL 2.0. Under")
  $out.Add("section 3.2 of that license you may obtain the corresponding source, in the form the")
  $out.Add("license requires and at no charge, from the repository named beside each package. This")
  $out.Add("applies whether or not the package was modified; KesVio modifies none of them.")
  $out.Add("")
  foreach ($package in $mpl) {
    $out.Add("  $($package.Name) $($package.Version)")
    $out.Add("      $($package.Source)")
  }
  $out.Add("")
}
$out.Add($rule)
$out.Add("1. Packages")
$out.Add($rule)

foreach ($ecosystem in @('npm', 'crates.io')) {
  $group = @($all | Where-Object { $_.Ecosystem -eq $ecosystem })
  if ($group.Count -eq 0) {
    continue
  }
  $out.Add("")
  if ($ecosystem -eq 'npm') {
    $out.Add("npm runtime dependencies ($($group.Count))")
  } else {
    $out.Add("Rust normal and build dependencies, x86_64-pc-windows-msvc ($($group.Count))")
  }
  $out.Add("")
  foreach ($package in $group) {
    $out.Add("  $($package.Name) $($package.Version)")
    $out.Add("      License:  $($package.Spdx)")
    $out.Add("      Source:   $($package.Source)")
    $out.Add("      Text:     $(($package.TextIds | ForEach-Object { "#$_" }) -join ', ')")
    if ($package.Fallback) {
      $out.Add("      Note:     upstream package ships no license file; the canonical text of the")
      $out.Add("                declared license is referenced above and the copyright holder is")
      $out.Add("                the package's authors, reachable through the source link.")
    }
  }
}

$out.Add("")
$out.Add($rule)
$out.Add("2. License texts")
$out.Add($rule)

foreach ($record in $textOrder) {
  $out.Add("")
  $out.Add("=" * 79)
  if ($record.Users -eq 1) {
    $out.Add("[#$($record.Id)] $($record.FileName) - $($record.Origin)")
  } else {
    $out.Add("[#$($record.Id)] $($record.FileName) - $($record.Origin) and $($record.Users - 1) other package(s)")
  }
  $out.Add("=" * 79)
  $out.Add("")
  foreach ($line in ($record.Text -split "`n")) {
    $out.Add($line.TrimEnd())
  }
}
$out.Add("")

[IO.File]::WriteAllText($OutputPath, (($out -join "`n") + "`n"), (New-Object Text.UTF8Encoding($false)))
Write-Output "Wrote ${OutputPath}: $($all.Count) packages, $($textOrder.Count) distinct license texts"
