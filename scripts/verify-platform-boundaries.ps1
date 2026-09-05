$ErrorActionPreference = "Stop"

$sourceRoot = "src-tauri/src"
if (-not (Test-Path -LiteralPath $sourceRoot)) {
  throw "Boundary scan path does not exist: $sourceRoot"
}

# Uses Select-String rather than an external grep so the check runs on any Windows PowerShell
# host and on a clean CI runner, neither of which is guaranteed to have ripgrep installed.
# .NET regex supports the same lookbehinds, so the pattern is unchanged.
$hits = @(
  Get-ChildItem -LiteralPath $sourceRoot -Recurse -File |
    Select-String -Pattern '(?<!platform::)(?<!os::)\bwindows::|\bwinreg::' -CaseSensitive |
    ForEach-Object {
      [pscustomobject]@{
        Path = (Resolve-Path -LiteralPath $_.Path -Relative) -replace '\\', '/' -replace '^\./', ''
        Text = "{0}:{1}:{2}" -f $_.Path, $_.LineNumber, $_.Line.Trim()
      }
    }
)

$violations = @($hits | Where-Object { $_.Path -notmatch '^src-tauri/src/platform/windows/' } | ForEach-Object { $_.Text })

if ($violations.Count -gt 0) {
  throw "Windows API escaped platform/windows:`n$($violations -join "`n")"
}

# Runtime startup registration is forbidden. Windows owns startup control, and Store packaging can
# declare a disabled startup task without teaching the running NSIS application to persist itself.
$forbiddenPersistence = @(
  Get-ChildItem -LiteralPath $sourceRoot -Recurse -File -Filter "*.rs" |
    Select-String -Pattern 'CurrentVersion\\Run\b|FOLDERID_Startup|shell:startup|SMSTARTUP' |
    ForEach-Object { "{0}:{1}:{2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() }
)

if ($forbiddenPersistence.Count -gt 0) {
  throw "Forbidden startup persistence mechanism found:`n$($forbiddenPersistence -join "`n")"
}

Write-Output "Verified Windows API ownership and no runtime startup registration"
