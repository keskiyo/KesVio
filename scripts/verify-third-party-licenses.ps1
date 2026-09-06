<#
Fails when THIRD_PARTY_LICENSES.txt no longer matches what the generator produces.

The committed file is what the installer ships, so a dependency added, removed or bumped in
package-lock.json or Cargo.lock must not be able to reach a release while the license texts still
describe the previous graph.

Comparison ignores carriage returns: the file is committed with LF, and a checkout with
core.autocrlf=true - the default on GitHub's Windows runners - rewrites them.
#>
param(
  # Pre-generated candidate. Omit to run the generator here.
  [string]$GeneratedPath,
  [string]$CommittedPath
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $CommittedPath) {
  $CommittedPath = Join-Path $repoRoot "THIRD_PARTY_LICENSES.txt"
}

if (-not (Test-Path -LiteralPath $CommittedPath)) {
  throw "$CommittedPath is missing; run scripts/generate-third-party-licenses.ps1"
}

$temporary = $null
try {
  if (-not $GeneratedPath) {
    $temporary = Join-Path ([IO.Path]::GetTempPath()) "kesvio-third-party-licenses-$([Guid]::NewGuid().ToString('N')).txt"
    & (Join-Path $PSScriptRoot "generate-third-party-licenses.ps1") -OutputPath $temporary | Out-Null
    $GeneratedPath = $temporary
  }
  if (-not (Test-Path -LiteralPath $GeneratedPath)) {
    throw "$GeneratedPath is missing; the generator produced no output"
  }

  $committed = [IO.File]::ReadAllText($CommittedPath) -replace "`r", ""
  $generated = [IO.File]::ReadAllText($GeneratedPath) -replace "`r", ""
  if ($committed -eq $generated) {
    $packages = ([regex]::Matches($committed, '(?m)^      License:  ')).Count
    $texts = ([regex]::Matches($committed, '(?m)^\[#')).Count
    Write-Output "Verified THIRD_PARTY_LICENSES.txt: $packages packages, $texts license texts, in sync with the manifests"
    return
  }

  $committedLines = $committed -split "`n"
  $generatedLines = $generated -split "`n"
  $limit = [Math]::Max($committedLines.Count, $generatedLines.Count)
  $firstDifference = $limit
  for ($index = 0; $index -lt $limit; $index++) {
    $left = if ($index -lt $committedLines.Count) { $committedLines[$index] } else { '<end of file>' }
    $right = if ($index -lt $generatedLines.Count) { $generatedLines[$index] } else { '<end of file>' }
    if ($left -ne $right) {
      $firstDifference = $index
      break
    }
  }
  $committedLine = if ($firstDifference -lt $committedLines.Count) { $committedLines[$firstDifference] } else { '<end of file>' }
  $generatedLine = if ($firstDifference -lt $generatedLines.Count) { $generatedLines[$firstDifference] } else { '<end of file>' }

  throw @"
THIRD_PARTY_LICENSES.txt is out of date with package-lock.json and Cargo.lock.
First difference at line $($firstDifference + 1):
  committed: $committedLine
  generated: $generatedLine
Regenerate it with scripts/generate-third-party-licenses.ps1 and commit the result.
"@
} finally {
  if ($temporary -and (Test-Path -LiteralPath $temporary)) {
    Remove-Item -LiteralPath $temporary -Force
  }
}
