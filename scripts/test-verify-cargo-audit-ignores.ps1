$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$script = Join-Path $repoRoot "scripts/verify-cargo-audit-ignores.ps1"
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) "kesvio-cargo-audit-test-$([Guid]::NewGuid().ToString('N'))"

function Write-Fixture {
  param([string]$Name, [string]$Content)

  $path = Join-Path $fixtureRoot $Name
  [IO.File]::WriteAllText($path, $Content)
  return $path
}

function Invoke-Gate {
  param([string]$Path, [string]$Today)

  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & powershell -NoProfile -File $script -AuditTomlPath $Path -Today $Today 2>$null | Out-Null
    return $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
}

function Assert-Exit {
  param([string]$Label, [int]$Expected, [int]$Actual)

  if ($Expected -eq 0 -and $Actual -ne 0) { throw "$Label should pass, exited $Actual" }
  if ($Expected -ne 0 -and $Actual -eq 0) { throw "$Label should fail, exited 0" }
}

try {
  New-Item -ItemType Directory -Path $fixtureRoot | Out-Null

  $shared = Write-Fixture -Name "shared.toml" -Content @"
[advisories]
ignore = [
  #   reviewBy:    2026-10-31
  "RUSTSEC-2026-0194",
  # Same chain and remediation as the entry above.
  "RUSTSEC-2026-0195",
  #   reviewBy:    2026-11-30
  "RUSTSEC-2026-0235",
]
"@
  Assert-Exit "entries before their review date" 0 (Invoke-Gate $shared "2026-10-31")
  Assert-Exit "an inherited date that has passed" 1 (Invoke-Gate $shared "2026-11-01")

  $undated = Write-Fixture -Name "undated.toml" -Content @"
[advisories]
ignore = [
  "RUSTSEC-2026-0001",
]
"@
  Assert-Exit "an entry without a review date" 1 (Invoke-Gate $undated "2026-01-01")

  $empty = Write-Fixture -Name "empty.toml" -Content @"
[advisories]
ignore = []
"@
  Assert-Exit "an empty ignore list" 0 (Invoke-Gate $empty "2030-01-01")

  Write-Output "Verified cargo-audit ignore expiry gate"
} finally {
  if (Test-Path -LiteralPath $fixtureRoot) {
    Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
  }
}
