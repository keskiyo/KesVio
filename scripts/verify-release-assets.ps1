param(
  [Parameter(Mandatory = $true)]
  [string]$AssetsDir,

  [Parameter(Mandatory = $true)]
  [string]$Tag
)

$ErrorActionPreference = "Stop"
$errors = New-Object System.Collections.Generic.List[string]

if (-not (Test-Path -LiteralPath $AssetsDir -PathType Container)) {
  throw "Assets directory does not exist: $AssetsDir"
}

$version = $Tag.TrimStart("v")
$latestPath = Join-Path $AssetsDir "latest.json"
$setupName = "KesVio_${version}_x64-setup.exe"
$setupPath = Join-Path $AssetsDir $setupName
$signaturePath = "$setupPath.sig"
$checksumPath = Join-Path $AssetsDir "SHA256SUMS.txt"
$publishedSetupName = $setupName.Replace(" ", ".")

foreach ($path in @($latestPath, $setupPath, $signaturePath, $checksumPath)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    $errors.Add("Required release asset is missing: $([IO.Path]::GetFileName($path))")
  }
}

$installers = Get-ChildItem -LiteralPath $AssetsDir -File -Filter "*.exe"
if ($installers.Count -ne 1) {
  $errors.Add("Expected exactly one setup .exe, found $($installers.Count): $($installers.Name -join ', ')")
}

if ($installers.Count -ge 1 -and $installers[0].Name -ne $setupName) {
  $errors.Add("Setup file name does not match ${Tag}: $($installers[0].Name)")
}

$unexpected = Get-ChildItem -LiteralPath $AssetsDir -File | Where-Object {
  $_.Name -match '\.(pdb|log|key|pub|tmp)$' -or
  $_.Name -match 'debug' -or
  ($_.Name -match 'Windows\.Apps_([0-9]+\.[0-9]+\.[0-9]+)' -and $Matches[1] -ne $version)
}
if ($unexpected) {
  $errors.Add("Unexpected release assets: $($unexpected.Name -join ', ')")
}

# The checksum file is the only verification step a user can run without gh, minisign or trust in
# the author, so a stale or malformed one must fail the release rather than reassure nobody.
if ((Test-Path -LiteralPath $checksumPath -PathType Leaf) -and (Test-Path -LiteralPath $setupPath -PathType Leaf)) {
  $checksumLines = @(Get-Content -LiteralPath $checksumPath | Where-Object { $_.Trim().Length -gt 0 })
  if ($checksumLines.Count -ne 1) {
    $errors.Add("SHA256SUMS.txt must hold exactly one entry, found $($checksumLines.Count)")
  } else {
    $entry = [regex]::Match($checksumLines[0], '^(?<hash>[0-9a-f]{64})\s\s(?<name>.+)$')
    if (-not $entry.Success) {
      $errors.Add("SHA256SUMS.txt is not in sha256sum format: $($checksumLines[0])")
    } else {
      if ($entry.Groups['name'].Value.Trim() -ne $setupName) {
        $errors.Add("SHA256SUMS.txt names '$($entry.Groups['name'].Value.Trim())' instead of $setupName")
      }
      $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $setupPath).Hash.ToLowerInvariant()
      if ($entry.Groups['hash'].Value -ne $actual) {
        $errors.Add("SHA256SUMS.txt does not match the installer it names")
      }
    }
  }
}

if (Test-Path -LiteralPath $latestPath -PathType Leaf) {
  try {
    $manifestText = Get-Content -LiteralPath $latestPath -Raw
    $manifest = $manifestText | ConvertFrom-Json

    if ($manifest.version -ne $version) {
      $errors.Add("latest.json version '$($manifest.version)' does not match $version")
    }

    if ($manifestText -match '(?i)\.msi|windows-x86_64-msi') {
      $errors.Add("latest.json must not contain MSI targets or URLs")
    }

    $expectedSize = (Get-Item -LiteralPath $setupPath).Length
    if ($manifest.packageSize -ne $expectedSize) {
      $errors.Add("latest.json packageSize '$($manifest.packageSize)' does not match $expectedSize")
    }

    $expectedReleaseUrl = "https://github.com/keskiyo/KesVio/releases/tag/$Tag"
    if ($manifest.releaseUrl -ne $expectedReleaseUrl) {
      $errors.Add("latest.json releaseUrl '$($manifest.releaseUrl)' does not match $expectedReleaseUrl")
    }

    if (-not $manifest.pub_date) {
      $errors.Add("latest.json has no publication date")
    }

    if ([Uri]::UnescapeDataString($manifestText) -notmatch [regex]::Escape($publishedSetupName)) {
      $errors.Add("latest.json does not reference published asset $publishedSetupName")
    }

    $genericTarget = $manifest.platforms."windows-x86_64"
    $nsisTarget = $manifest.platforms."windows-x86_64-nsis"
    foreach ($target in @(
      @{ Name = "windows-x86_64"; Value = $genericTarget },
      @{ Name = "windows-x86_64-nsis"; Value = $nsisTarget }
    )) {
      if (-not $target.Value) {
        $errors.Add("latest.json is missing updater target '$($target.Name)'")
        continue
      }

      $targetFile = [IO.Path]::GetFileName([Uri]::UnescapeDataString(([Uri]$target.Value.url).AbsolutePath))
      if ($targetFile -ne $publishedSetupName) {
        $errors.Add("latest.json target '$($target.Name)' references '$targetFile' instead of $publishedSetupName")
      }
      if (-not $target.Value.signature) {
        $errors.Add("latest.json target '$($target.Name)' has no updater signature")
      }
    }

    if ($genericTarget.url -ne $nsisTarget.url -or $genericTarget.signature -ne $nsisTarget.signature) {
      $errors.Add("Generic and NSIS updater targets must reference the same package and signature")
    }

    if ($manifestText -notmatch '"signature"\s*:\s*"[^"]+"') {
      $errors.Add("latest.json does not contain an updater signature")
    }
  } catch {
    $errors.Add("latest.json is not valid JSON: $($_.Exception.Message)")
  }
}

if ($errors.Count -gt 0) {
  throw "Release asset verification failed:`n- $($errors -join "`n- ")"
}

Write-Output "Verified release assets for $Tag"
