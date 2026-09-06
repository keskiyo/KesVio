$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$script = Join-Path $repoRoot "scripts/verify-third-party-licenses.ps1"
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) "kesvio-third-party-licenses-test-$([Guid]::NewGuid().ToString('N'))"

function Write-Fixture {
  param([string]$Name, [string]$Content)

  $path = Join-Path $fixtureRoot $Name
  [IO.File]::WriteAllText($path, $Content, (New-Object Text.UTF8Encoding($false)))
  return $path
}

function Invoke-Gate {
  param([string]$CommittedPath, [string]$GeneratedPath)

  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & powershell -NoProfile -File $script -CommittedPath $CommittedPath -GeneratedPath $GeneratedPath 2>$null | Out-Null
    return $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
}

$sample = @"
KesVio 0.5.0 - third-party licenses

  react 18.3.1
      License:  MIT
      Source:   https://github.com/facebook/react
      Text:     #1

[#1] LICENSE - react 18.3.1
"@

try {
  New-Item -ItemType Directory -Path $fixtureRoot | Out-Null

  $committed = Write-Fixture -Name "committed.txt" -Content ($sample -replace "`r`n", "`n")
  $identical = Write-Fixture -Name "identical.txt" -Content ($sample -replace "`r`n", "`n")

  $exit = Invoke-Gate -CommittedPath $committed -GeneratedPath $identical
  if ($exit -ne 0) {
    throw "Identical files must pass, got exit code $exit"
  }

  # A checkout with core.autocrlf=true hands the gate CRLF for the same committed bytes.
  $carriageReturns = Write-Fixture -Name "crlf.txt" -Content (($sample -replace "`r`n", "`n") -replace "`n", "`r`n")
  $exit = Invoke-Gate -CommittedPath $carriageReturns -GeneratedPath $identical
  if ($exit -ne 0) {
    throw "A CRLF checkout must pass, got exit code $exit"
  }

  $bumped = Write-Fixture -Name "bumped.txt" -Content (($sample -replace "`r`n", "`n") -replace "18\.3\.1", "18.3.2")
  $exit = Invoke-Gate -CommittedPath $committed -GeneratedPath $bumped
  if ($exit -eq 0) {
    throw "A version bump the committed file does not carry must fail"
  }

  $truncated = Write-Fixture -Name "truncated.txt" -Content "KesVio 0.5.0 - third-party licenses`n"
  $exit = Invoke-Gate -CommittedPath $committed -GeneratedPath $truncated
  if ($exit -eq 0) {
    throw "A generated file missing packages must fail"
  }

  $exit = Invoke-Gate -CommittedPath (Join-Path $fixtureRoot "absent.txt") -GeneratedPath $identical
  if ($exit -eq 0) {
    throw "A missing committed file must fail"
  }

  Write-Output "Verified third-party license gate: 5 cases"
} finally {
  if (Test-Path -LiteralPath $fixtureRoot) {
    Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
  }
}
