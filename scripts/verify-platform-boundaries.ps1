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

# Runtime startup registration is forbidden. Windows owns startup control; the one thing the running
# program may do is flip the StartupApproved value of a shortcut the installer created, and only
# `registry/startup_approval.rs` may do that. `known_folders.rs` names FOLDERID_Startup for the
# read-only path lookup that module uses.
$approvalModule = (Resolve-Path -LiteralPath (Join-Path $sourceRoot "platform\windows\registry\startup_approval.rs")).Path
$knownFolders = (Resolve-Path -LiteralPath (Join-Path $sourceRoot "platform\windows\known_folders.rs")).Path
$forbiddenPersistence = @(
  Get-ChildItem -LiteralPath $sourceRoot -Recurse -File -Filter "*.rs" |
    Where-Object { $_.FullName -ne $approvalModule -and $_.FullName -ne $knownFolders } |
    Select-String -Pattern 'CurrentVersion\\Run\b|FOLDERID_Startup|shell:startup|SMSTARTUP|StartupApproved' |
    ForEach-Object { "{0}:{1}:{2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() }
)

if ($forbiddenPersistence.Count -gt 0) {
  throw "Forbidden startup persistence mechanism found:`n$($forbiddenPersistence -join "`n")"
}

$approvalWrites = @(
  Select-String -Path $approvalModule -Pattern 'IShellLink|CurrentVersion\\Run\b|fs::write|File::create|remove_file|copy\(|Command::new|ShellExecute' |
    ForEach-Object { "{0}:{1}:{2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() }
)

if ($approvalWrites.Count -gt 0) {
  throw "startup_approval.rs may only toggle the approval value:`n$($approvalWrites -join "`n")"
}

Write-Output "Verified Windows API ownership; startup registration limited to approval toggling"
