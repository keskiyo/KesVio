param(
  [ValidateSet("release", "debug")]
  [string]$BackendProfile = "release",

  [switch]$SkipBackend,

  [switch]$SkipFrontend
)

# Performance baseline protocol (INFO.md §8.4, F17): the pure stages that a budget can hold
# without a native window — the backend cached-startup pipeline on the pinned 2000-record corpus
# (p50/p95 over 11 samples from `catalog::golden::timings::stage_timings`) and the frontend search
# ranking on a 2000-record synthetic catalog (`tests/perf/*.bench.ts`). Every artifact records the
# revision, machine, build profile and sample counts so two runs can be compared; the native
# metrics (cached startup to a usable search field, tray open, idle CPU, memory over cycles) are
# measured by hand with the protocol in docs/superpowers/performance-budgets.md.

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$evidenceDirectory = Join-Path $repoRoot ".1localDocuments\perf"
$stamp = [DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss")
$scratch = Join-Path $env:TEMP "kesvio-perf\$stamp"
[IO.Directory]::CreateDirectory($scratch) | Out-Null

function Get-WebView2Version {
  foreach ($key in @(
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    "HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
  )) {
    try {
      $value = (Get-ItemProperty -Path $key -Name pv -ErrorAction Stop).pv
      if ($value) { return $value }
    } catch {}
  }
  return $null
}

$processor = Get-CimInstance Win32_Processor | Select-Object -First 1
$system = Get-CimInstance Win32_OperatingSystem
$machine = [ordered]@{
  cpu = $processor.Name.Trim()
  logicalProcessors = $processor.NumberOfLogicalProcessors
  memoryBytes = [long]$system.TotalVisibleMemorySize * 1024
  os = "$($system.Caption) $($system.Version)"
  webView2 = Get-WebView2Version
  node = (& node --version).Trim()
  rustc = (& rustc --version).Trim()
}

$frontend = $null
if (-not $SkipFrontend) {
  $benchOutput = Join-Path $scratch "frontend-bench.json"
  Push-Location $repoRoot
  try {
    & npx vitest bench --run tests/perf --outputJson $benchOutput | Out-Null
  } finally {
    Pop-Location
  }
  if (-not (Test-Path -LiteralPath $benchOutput -PathType Leaf)) {
    throw "The frontend bench wrote no report"
  }
  $report = Get-Content -LiteralPath $benchOutput -Raw -Encoding UTF8 | ConvertFrom-Json
  $frontend = @(foreach ($file in $report.files) {
    foreach ($group in $file.groups) {
      foreach ($entry in $group.benchmarks) {
        [ordered]@{
          name = $entry.name
          meanMs = [Math]::Round([double]$entry.mean, 4)
          p75Ms = [Math]::Round([double]$entry.p75, 4)
          p99Ms = [Math]::Round([double]$entry.p99, 4)
          samples = $entry.sampleCount
        }
      }
    }
  })
}

$backend = $null
if (-not $SkipBackend) {
  $arguments = @("test", "--manifest-path", (Join-Path $repoRoot "src-tauri\Cargo.toml"))
  if ($BackendProfile -eq "release") { $arguments += "--release" }
  $arguments += @("stage_timings", "--", "--ignored", "--nocapture")
  $output = & cargo @arguments | Out-String
  $line = [regex]::Match($output, "KESVIO_PERF (\{.*\})")
  if (-not $line.Success) {
    throw "The backend timings printed no KESVIO_PERF line`n$output"
  }
  $backend = $line.Groups[1].Value | ConvertFrom-Json
}

$record = [ordered]@{
  sourceCommit = (& git -C $repoRoot rev-parse HEAD).Trim()
  workingTreeDirty = [bool](& git -C $repoRoot status --porcelain)
  measuredAt = [DateTime]::UtcNow.ToString("o")
  machine = $machine
  backend = $backend
  frontend = $frontend
}
[IO.Directory]::CreateDirectory($evidenceDirectory) | Out-Null
$outputPath = Join-Path $evidenceDirectory "perf-$stamp.json"
[IO.File]::WriteAllText($outputPath, ($record | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
Remove-Item -LiteralPath $scratch -Recurse -Force -ErrorAction SilentlyContinue
Write-Output "Performance evidence: $outputPath"
if ($backend) {
  Write-Output "Backend ($($backend.profile), $($backend.records) records):"
  foreach ($stage in $backend.stages) {
    Write-Output ("  {0,-52} p50 {1,9:N3} ms  p95 {2,9:N3} ms" -f $stage.stage, $stage.p50Ms, $stage.p95Ms)
  }
}
if ($frontend) {
  Write-Output "Frontend (2000 synthetic records):"
  foreach ($entry in $frontend) {
    Write-Output ("  {0,-40} mean {1,7:N3} ms  p99 {2,7:N3} ms" -f $entry.name, $entry.meanMs, $entry.p99Ms)
  }
}
