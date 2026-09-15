param(
  [string]$ExecutablePath,

  [string]$WorkspaceRoot = (Join-Path $env:TEMP "kesvio-smoke"),

  [ValidateRange(30, 900)]
  [int]$StartupTimeoutSeconds = 180,

  [switch]$KeepWorkspace
)

# Native smoke run: launch the built executable from a throw-away folder beside its own data
# root, and prove state, not window presence — the data folder it reports, the cache it writes,
# the records the fixture folder yields, the hide-on-close, the single instance, the warm restart.
# It never touches the installed copy, the per-user stores or the registry; the installer and the
# updater stay manual (docs/superpowers/native-smoke.md). The executable must embed the frontend:
# `src-tauri/target/release/KesVio.exe` from `npm run tauri build`, or a
# `cargo build --release --features tauri/custom-protocol` binary. A plain `cargo build` binary is a
# dev-mode build that expects the Vite dev server and shows an empty window.

$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class KesVioSmokeWindows {
  delegate bool EnumProc(IntPtr handle, IntPtr parameter);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr parameter);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr handle);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr handle, StringBuilder text, int capacity);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool PostMessage(IntPtr handle, uint message, IntPtr wParam, IntPtr lParam);
  const uint WM_CLOSE = 0x0010;
  public static IntPtr FindVisible(uint processId, string title) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((handle, parameter) => {
      uint owner;
      GetWindowThreadProcessId(handle, out owner);
      if (owner != processId || !IsWindowVisible(handle)) return true;
      var text = new StringBuilder(256);
      GetWindowText(handle, text, text.Capacity);
      if (text.ToString() != title) return true;
      found = handle;
      return false;
    }, IntPtr.Zero);
    return found;
  }
  public static bool RequestClose(IntPtr handle) {
    return PostMessage(handle, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
  }
}
"@
$repoRoot = Split-Path -Parent $PSScriptRoot
$evidenceDirectory = Join-Path $repoRoot ".1localDocuments"
$stamp = [DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss")
$workspace = Join-Path $WorkspaceRoot $stamp
$appDirectory = Join-Path $workspace "App"
$dataRoot = Join-Path $appDirectory "KesVioData"
$dataDirectory = Join-Path $dataRoot "data"
$logDirectory = Join-Path $dataRoot "logs"
$fixtureDirectory = Join-Path $workspace "Fixtures\Portable"
$results = [Collections.Generic.List[object]]::new()
$smokeProcess = $null

function Resolve-Executable {
  param([string]$Requested)
  if ($Requested) {
    if (-not (Test-Path -LiteralPath $Requested -PathType Leaf)) {
      throw "Native smoke executable not found"
    }
    return [IO.Path]::GetFullPath($Requested)
  }
  foreach ($candidate in @(
    (Join-Path $repoRoot "src-tauri\target\release\KesVio.exe"),
    (Join-Path $repoRoot "src-tauri\target\release\app.exe"),
    (Join-Path $repoRoot "src-tauri\target\debug\app.exe")
  )) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      return [IO.Path]::GetFullPath($candidate)
    }
  }
  throw "Native smoke executable not found"
}

function Add-Result {
  param([string]$Step, [bool]$Passed, [string]$Detail)
  $results.Add([ordered]@{ step = $Step; passed = $Passed; detail = $Detail })
  $marker = if ($Passed) { "ok  " } else { "FAIL" }
  Write-Output "[$marker] $Step - $Detail"
  if (-not $Passed) {
    throw "Native smoke step failed: $Step"
  }
}

function Get-OtherKesVioProcesses {
  return @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $_.ProcessName -in @("KesVio", "app") -and $_.Path -and (
      $_.Path -like "*KesVio*" -or $_.Path -like "*src-tauri*"
    )
  })
}

function Get-LogText {
  if (-not (Test-Path -LiteralPath $logDirectory -PathType Container)) {
    return ""
  }
  $text = ""
  foreach ($file in Get-ChildItem -LiteralPath $logDirectory -File -Filter "*.log" | Sort-Object Name) {
    $stream = [IO.File]::Open($file.FullName, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
    try {
      $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::UTF8)
      $text += $reader.ReadToEnd()
    } finally {
      $stream.Dispose()
    }
  }
  return $text
}

function Wait-LogLine {
  param([string]$Pattern, [int]$TimeoutSeconds, [int]$Occurrences = 1)
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    $text = Get-LogText
    if (([regex]::Matches($text, $Pattern)).Count -ge $Occurrences) {
      return $text
    }
    if ($smokeProcess -and $smokeProcess.HasExited) {
      throw "The smoke process exited before the log reported '$Pattern' (another KesVio instance may be running)"
    }
    Start-Sleep -Milliseconds 500
  }
  throw "The log did not report '$Pattern' within $TimeoutSeconds seconds"
}

function Start-Smoke {
  param([string]$Executable)
  return Start-Process -FilePath $Executable -WorkingDirectory $appDirectory -PassThru
}

function Stop-Smoke {
  param([System.Diagnostics.Process]$Target)
  if (-not $Target -or $Target.HasExited) {
    return
  }
  $live = Get-Process -Id $Target.Id -ErrorAction SilentlyContinue
  if (-not $live) {
    return
  }
  $livePath = [IO.Path]::GetFullPath($live.Path)
  if (-not $livePath.StartsWith($appDirectory, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to stop a process outside the smoke workspace"
  }
  Stop-Process -Id $Target.Id -Force
  $Target.WaitForExit(15000) | Out-Null
}

function Get-FolderStamp {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
    return "absent"
  }
  # WebView2 keeps its own profile under the per-user folder (`EBWebView`) whatever the data root
  # is; that is the browser runtime, not KesVio data, so it is not part of the isolation proof.
  $newest = Get-ChildItem -LiteralPath $Path -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\EBWebView\\' } |
    Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
  if ($newest) {
    return $newest.LastWriteTimeUtc.ToString("o")
  }
  return "empty"
}

$executable = Resolve-Executable -Requested $ExecutablePath
$others = Get-OtherKesVioProcesses
if ($others.Count -gt 0) {
  throw "Another KesVio process is running (pid $($others[0].Id)); the single-instance guard would end the smoke process at once. Quit it first."
}

$protectedFolders = [ordered]@{
  perUserData = Join-Path $env:APPDATA "keskiyo.kesvio"
  perUserLogs = Join-Path $env:LOCALAPPDATA "keskiyo.kesvio"
  installedCopy = Join-Path $env:LOCALAPPDATA "KesVio"
}
$baseline = [ordered]@{}
foreach ($entry in $protectedFolders.GetEnumerator()) {
  $baseline[$entry.Key] = Get-FolderStamp -Path $entry.Value
}

[IO.Directory]::CreateDirectory($dataDirectory) | Out-Null
[IO.Directory]::CreateDirectory($logDirectory) | Out-Null
Copy-Item -LiteralPath $executable -Destination (Join-Path $appDirectory ([IO.Path]::GetFileName($executable)))
$smokeExecutable = Join-Path $appDirectory ([IO.Path]::GetFileName($executable))

$fixtureSources = @(
  @{ folder = "Alpha"; source = (Join-Path $env:SystemRoot "System32\notepad.exe") },
  @{ folder = "Beta"; source = (Join-Path $env:SystemRoot "System32\charmap.exe") },
  @{ folder = "Gamma"; source = (Join-Path $env:SystemRoot "System32\dxdiag.exe") }
)
$fixtureCount = 0
foreach ($fixture in $fixtureSources) {
  if (-not (Test-Path -LiteralPath $fixture.source -PathType Leaf)) {
    continue
  }
  $target = Join-Path $fixtureDirectory $fixture.folder
  [IO.Directory]::CreateDirectory($target) | Out-Null
  Copy-Item -LiteralPath $fixture.source -Destination (Join-Path $target "$($fixture.folder).exe")
  $fixtureCount += 1
}
if ($fixtureCount -eq 0) {
  throw "No fixture executable could be copied from System32"
}

$settings = [ordered]@{
  autoScanFixedDrives = $false
  includedPaths = @($fixtureDirectory)
  excludedPaths = @()
  catalogTargetAvailabilityV1 = $true
  catalogPortableFingerprintV1 = $true
}
[IO.File]::WriteAllText((Join-Path $dataDirectory "scan-settings.json"), ($settings | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
# A profile with no catalog waits for the user's explicit first scan; an empty published catalog
# is what makes the interface request the ordinary startup scan on its own.
[IO.File]::WriteAllText((Join-Path $dataDirectory "apps-cache.json"), '{"schemaVersion":11,"generation":0,"apps":[]}', [Text.UTF8Encoding]::new($false))

$startedAt = [DateTime]::UtcNow
$exitCode = 1
try {
  $smokeProcess = Start-Smoke -Executable $smokeExecutable
  try {
    Wait-LogLine -Pattern "Scan submitted: request=Startup" -TimeoutSeconds 45 | Out-Null
  } catch {
    throw "The interface never requested the startup scan: the executable is probably a dev-mode build without the embedded frontend (build it with 'npm run tauri build' or 'cargo build --release --features tauri/custom-protocol')"
  }
  $text = Wait-LogLine -Pattern "Scan finished: mode=startup" -TimeoutSeconds $StartupTimeoutSeconds
  $dataLine = [regex]::Match($text, "Data folder: ([^\r\n]+)")
  Add-Result -Step "data folder beside the executable" -Passed ($dataLine.Success -and $dataLine.Groups[1].Value.Trim().Equals($dataDirectory, [StringComparison]::OrdinalIgnoreCase)) -Detail ($(if ($dataLine.Success) { $dataLine.Groups[1].Value.Trim() } else { "no Data folder line" }))
  Add-Result -Step "tray icon created" -Passed ($text -match "Tray icon created: id=kesvio") -Detail "log reports the tray icon"
  Add-Result -Step "volume watcher started" -Passed ($text -match "Volume watcher started") -Detail "log reports the watcher"

  $cachePath = Join-Path $dataDirectory "apps-cache.json"
  Add-Result -Step "catalog cache written" -Passed (Test-Path -LiteralPath $cachePath -PathType Leaf) -Detail $cachePath
  $cache = Get-Content -LiteralPath $cachePath -Raw -Encoding UTF8 | ConvertFrom-Json
  $fixtureRecords = @($cache.apps | Where-Object { $_.scanFolder -and $_.scanFolder.TrimEnd('\').Equals($fixtureDirectory.TrimEnd('\'), [StringComparison]::OrdinalIgnoreCase) })
  $firstGeneration = [long]$cache.generation
  Add-Result -Step "first generation published" -Passed ($firstGeneration -ge 1 -and [int]$cache.schemaVersion -ge 11) -Detail "generation=$firstGeneration schema=$($cache.schemaVersion) records=$($cache.apps.Count)"
  Add-Result -Step "fixture folder scanned" -Passed ($fixtureRecords.Count -ge 1) -Detail "$($fixtureRecords.Count) of $fixtureCount fixture executables became records: $(($fixtureRecords | ForEach-Object { $_.name }) -join ', ')"
  $portableSource = @($cache.sources | Where-Object { $_.key -eq "portable" })
  Add-Result -Step "portable source snapshot kept" -Passed ($portableSource.Count -eq 1) -Detail "sources=$(($cache.sources | ForEach-Object { $_.key }) -join ', ')"

  $windowHandle = [IntPtr]::Zero
  $windowDeadline = [DateTime]::UtcNow.AddSeconds(30)
  while ($windowHandle -eq [IntPtr]::Zero -and [DateTime]::UtcNow -lt $windowDeadline) {
    $windowHandle = [KesVioSmokeWindows]::FindVisible([uint32]$smokeProcess.Id, "KesVio")
    if ($windowHandle -eq [IntPtr]::Zero) { Start-Sleep -Milliseconds 500 }
  }
  Add-Result -Step "main window shown" -Passed ($windowHandle -ne [IntPtr]::Zero) -Detail "visible window titled KesVio handle=$windowHandle"
  $closeRequested = [KesVioSmokeWindows]::RequestClose($windowHandle)
  $hiddenDeadline = [DateTime]::UtcNow.AddSeconds(10)
  $stillVisible = $true
  while ($stillVisible -and [DateTime]::UtcNow -lt $hiddenDeadline) {
    Start-Sleep -Milliseconds 500
    $stillVisible = [KesVioSmokeWindows]::FindVisible([uint32]$smokeProcess.Id, "KesVio") -ne [IntPtr]::Zero
  }
  $smokeProcess.Refresh()
  Add-Result -Step "close hides to the tray" -Passed ($closeRequested -and -not $stillVisible -and -not $smokeProcess.HasExited) -Detail "WM_CLOSE sent=$closeRequested, window hidden=$(-not $stillVisible), process alive=$(-not $smokeProcess.HasExited)"

  $second = Start-Smoke -Executable $smokeExecutable
  $secondExited = $second.WaitForExit(15000)
  $text = Wait-LogLine -Pattern "Second instance forwarded to this process: shown=true" -TimeoutSeconds 15
  $smokeProcess.Refresh()
  Add-Result -Step "single instance" -Passed ($secondExited -and -not $smokeProcess.HasExited) -Detail "second launch exited=$secondExited, first alive, forwarded"

  Stop-Smoke -Target $smokeProcess
  Add-Result -Step "first process stopped" -Passed $smokeProcess.HasExited -Detail "pid $($smokeProcess.Id)"

  $smokeProcess = Start-Smoke -Executable $smokeExecutable
  $text = Wait-LogLine -Pattern "Scan finished: mode=startup" -TimeoutSeconds $StartupTimeoutSeconds -Occurrences 2
  $previous = [regex]::Matches($text, "Catalog persistence: previous generation=(\d+) records=(\d+)")
  $warm = $previous[$previous.Count - 1]
  Add-Result -Step "warm start reuses the cache" -Passed ($previous.Count -ge 2 -and [long]$warm.Groups[1].Value -ge $firstGeneration -and [long]$warm.Groups[2].Value -ge 1) -Detail "previous generation=$($warm.Groups[1].Value) records=$($warm.Groups[2].Value)"
  $finished = [regex]::Matches($text, "Scan finished: mode=startup [^\r\n]*added=(\d+) updated=(\d+) removed=(\d+)")
  $warmScan = $finished[$finished.Count - 1]
  Add-Result -Step "warm scan is stable" -Passed ([int]$warmScan.Groups[1].Value -eq 0 -and [int]$warmScan.Groups[3].Value -eq 0) -Detail "added=$($warmScan.Groups[1].Value) updated=$($warmScan.Groups[2].Value) removed=$($warmScan.Groups[3].Value)"
  $reloaded = Get-Content -LiteralPath $cachePath -Raw -Encoding UTF8 | ConvertFrom-Json
  Add-Result -Step "generation advanced" -Passed ([long]$reloaded.generation -gt $firstGeneration) -Detail "generation $firstGeneration -> $($reloaded.generation)"

  Stop-Smoke -Target $smokeProcess

  $untouched = $true
  $touched = @()
  foreach ($entry in $protectedFolders.GetEnumerator()) {
    $after = Get-FolderStamp -Path $entry.Value
    if ($after -ne $baseline[$entry.Key]) {
      $untouched = $false
      $touched += $entry.Key
    }
  }
  Add-Result -Step "per-user and installed stores untouched" -Passed $untouched -Detail ($(if ($untouched) { ($protectedFolders.Keys -join ', ') } else { "written: " + ($touched -join ', ') }))
  $exitCode = 0
} catch {
  $results.Add([ordered]@{ step = "aborted"; passed = $false; detail = $_.Exception.Message })
  Write-Output "[FAIL] $($_.Exception.Message)"
} finally {
  try {
    Stop-Smoke -Target $smokeProcess
  } catch {
    Write-Output "[warn] $($_.Exception.Message)"
  }
  $record = [ordered]@{
    sourceCommit = (& git -C $repoRoot rev-parse HEAD).Trim()
    executable = [ordered]@{
      path = $executable
      fileVersion = (Get-Item -LiteralPath $executable).VersionInfo.FileVersion
      sha256 = (Get-FileHash -LiteralPath $executable -Algorithm SHA256).Hash
    }
    workspace = $workspace
    startedAt = $startedAt.ToString("o")
    finishedAt = [DateTime]::UtcNow.ToString("o")
    passed = ($exitCode -eq 0)
    steps = $results
    logs = @(if (Test-Path -LiteralPath $logDirectory) { Get-ChildItem -LiteralPath $logDirectory -File | ForEach-Object { [ordered]@{ name = $_.Name; sizeBytes = $_.Length } } })
  }
  [IO.Directory]::CreateDirectory($evidenceDirectory) | Out-Null
  $outputPath = Join-Path $evidenceDirectory "native-smoke-$stamp.json"
  [IO.File]::WriteAllText($outputPath, ($record | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
  Write-Output "Native smoke evidence: $outputPath"
  if (-not $KeepWorkspace -and (Test-Path -LiteralPath $workspace -PathType Container)) {
    Remove-Item -LiteralPath $workspace -Recurse -Force -ErrorAction SilentlyContinue
  } else {
    Write-Output "Workspace kept: $workspace"
  }
}
exit $exitCode
