$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$generator = Join-Path $repoRoot "scripts/generate-sbom.ps1"
$output = Join-Path ([IO.Path]::GetTempPath()) "kesvio-sbom-test-$([Guid]::NewGuid().ToString('N')).cdx.json"

try {
  & powershell -NoProfile -File $generator -OutputPath $output | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "SBOM generator exited $LASTEXITCODE"
  }
  $bom = [IO.File]::ReadAllText($output) | ConvertFrom-Json
  $package = [IO.File]::ReadAllText((Join-Path $repoRoot "package.json")) | ConvertFrom-Json

  if ($bom.bomFormat -ne "CycloneDX" -or $bom.specVersion -ne "1.5") {
    throw "SBOM is not CycloneDX 1.5"
  }
  if ($bom.metadata.component.name -ne "KesVio" -or $bom.metadata.component.version -ne $package.version) {
    throw "SBOM does not describe KesVio $($package.version)"
  }

  $purls = @($bom.components | ForEach-Object { $_.purl })
  if (($purls | Sort-Object -Unique).Count -ne $purls.Count) {
    throw "SBOM lists a component twice"
  }
  foreach ($component in $bom.components) {
    if (-not "$($component.version)".Trim() -or $component.purl -notmatch '^pkg:(npm|cargo)/') {
      throw "SBOM component without a version or purl: $($component.name)"
    }
  }

  # What the installer ships, from both ecosystems. react was the package `npm sbom` lost.
  foreach ($required in @('pkg:npm/react@', 'pkg:npm/react-dom@', 'pkg:npm/zustand@', 'pkg:cargo/tauri@', 'pkg:cargo/windows@')) {
    if (-not ($purls | Where-Object { $_.StartsWith($required) })) {
      throw "SBOM is missing $required"
    }
  }
  # Development tooling, Tauri's Linux backend and the application crate itself are not shipped.
  foreach ($forbidden in @('pkg:npm/vitest@', 'pkg:npm/eslint@', 'pkg:cargo/gtk@', 'pkg:cargo/webkit2gtk@', 'pkg:cargo/app@')) {
    if ($purls | Where-Object { $_.StartsWith($forbidden) }) {
      throw "SBOM lists $forbidden, which the installer does not ship"
    }
  }

  Write-Output "Verified SBOM generator ($($purls.Count) components)"
} finally {
  if (Test-Path -LiteralPath $output) {
    Remove-Item -LiteralPath $output -Force
  }
}
