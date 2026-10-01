<#
Writes a CycloneDX 1.5 software bill of materials for what the installer ships: the npm packages
bundled into the frontend (`npm ls --omit=dev --all`) and the crates compiled into KesVio.exe for
x86_64-pc-windows-msvc (`cargo tree -e normal`). Both graphs are the same ones
generate-third-party-licenses.ps1 reads, so the SBOM and the bundled license texts describe one
dependency set. `npm sbom --omit=dev` is not used: it drops react, react-dom and scheduler, which
the lockfile also reaches through development tooling.
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$package = [IO.File]::ReadAllText((Join-Path $repoRoot "package.json")) | ConvertFrom-Json

function New-Component {
  param([string]$Ecosystem, [string]$Name, [string]$Version, [string]$License)

  $purlName = if ($Ecosystem -eq "npm") { $Name.Replace("@", "%40") } else { $Name }
  $purl = "pkg:$Ecosystem/$purlName@$Version"
  $component = [ordered]@{
    type      = "library"
    "bom-ref" = $purl
    name      = $Name
    version   = $Version
    purl      = $purl
  }
  if ("$License".Trim() -and $License -ne "UNKNOWN") {
    $component.licenses = @([ordered]@{ expression = $License.Trim() })
  }
  return $component
}

function Read-NpmComponents {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $listing = (& npm ls --omit=dev --all --json --prefix $repoRoot 2>$null) -join "`n"
  $ErrorActionPreference = $previous
  if (-not $listing.Trim()) {
    throw "npm ls produced no output"
  }
  $flat = [ordered]@{}
  $pending = New-Object System.Collections.Generic.Queue[object]
  $pending.Enqueue(($listing | ConvertFrom-Json))
  while ($pending.Count -gt 0) {
    $node = $pending.Dequeue()
    if (-not $node -or -not ($node.PSObject.Properties.Name -contains 'dependencies')) {
      continue
    }
    foreach ($entry in $node.dependencies.PSObject.Properties) {
      if (-not "$($entry.Value.version)".Trim()) {
        continue
      }
      $flat["$($entry.Name)@$($entry.Value.version)"] = $entry
      $pending.Enqueue($entry.Value)
    }
  }
  foreach ($key in $flat.Keys) {
    $entry = $flat[$key]
    $manifestPath = Join-Path $repoRoot "node_modules/$($entry.Name)/package.json"
    $license = "UNKNOWN"
    if (Test-Path -LiteralPath $manifestPath) {
      $manifest = [IO.File]::ReadAllText($manifestPath) | ConvertFrom-Json
      if ("$($manifest.license)".Trim()) {
        $license = "$($manifest.license)"
      }
    }
    New-Component -Ecosystem "npm" -Name $entry.Name -Version "$($entry.Value.version)" -License $license
  }
}

function Read-CargoComponents {
  $manifest = Join-Path $repoRoot "src-tauri/Cargo.toml"
  $lines = & cargo tree --locked --manifest-path $manifest -e normal --target x86_64-pc-windows-msvc --prefix none --format "{p}|{l}"
  if ($LASTEXITCODE -ne 0) {
    throw "cargo tree failed with exit code $LASTEXITCODE"
  }
  $seen = @{}
  foreach ($line in $lines) {
    $match = [regex]::Match($line, '^(?<name>\S+) v(?<version>[^\s|]+)(?<local> \([A-Za-z]:\\[^)]*\))?(?: \(\*\))?\|(?<license>.*)$')
    if (-not $match.Success -or $match.Groups['local'].Success) {
      continue
    }
    $key = "$($match.Groups['name'].Value)@$($match.Groups['version'].Value)"
    if ($seen.ContainsKey($key)) {
      continue
    }
    $seen[$key] = $true
    New-Component -Ecosystem "cargo" -Name $match.Groups['name'].Value -Version $match.Groups['version'].Value -License $match.Groups['license'].Value
  }
}

$components = @(@(Read-NpmComponents) + @(Read-CargoComponents) | Sort-Object { $_.purl })
if ($components.Count -eq 0) {
  throw "No components were collected"
}

$bom = [ordered]@{
  bomFormat   = "CycloneDX"
  specVersion = "1.5"
  version     = 1
  metadata    = [ordered]@{
    component = [ordered]@{
      type      = "application"
      "bom-ref" = "pkg:github/keskiyo/KesVio@$($package.version)"
      name      = "KesVio"
      version   = "$($package.version)"
      licenses  = @([ordered]@{ expression = "MIT" })
    }
  }
  components  = $components
}

$directory = Split-Path -Parent ([IO.Path]::GetFullPath($OutputPath))
[IO.Directory]::CreateDirectory($directory) | Out-Null
[IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputPath), ($bom | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding($false)))
Write-Output "Wrote SBOM with $($components.Count) components to $OutputPath"
