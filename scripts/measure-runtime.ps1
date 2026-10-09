param(
  [string]$ProcessName = 'KesVio',
  [string]$LogDirectory = ''
)
$ErrorActionPreference = 'Stop'

$root = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue |
  Sort-Object StartTime |
  Select-Object -First 1
if (-not $root) {
  throw "Process '$ProcessName' is not running."
}

$all = @(Get-CimInstance Win32_Process)
$tree = New-Object System.Collections.Generic.List[int]
$tree.Add([int]$root.Id)
do {
  $added = @(
    $all | Where-Object {
      $tree.Contains([int]$_.ParentProcessId) -and
      -not $tree.Contains([int]$_.ProcessId) -and
      $_.Name -eq 'msedgewebview2.exe'
    }
  )
  foreach ($process in $added) { $tree.Add([int]$process.ProcessId) }
} while ($added.Count -gt 0)

$processes = @($tree | ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue })
$private = ($processes | Measure-Object PrivateMemorySize64 -Sum).Sum
$working = ($processes | Measure-Object WorkingSet64 -Sum).Sum

$frontendReady = $null
if ($LogDirectory -and (Test-Path -LiteralPath $LogDirectory)) {
  $log = Get-ChildItem -LiteralPath $LogDirectory -Filter '*.log' |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($log) {
    $match = Select-String -LiteralPath $log.FullName -Pattern 'Frontend ready: (\d+)ms' |
      Select-Object -Last 1
    if ($match) { $frontendReady = [int]$match.Matches[0].Groups[1].Value }
  }
}

[pscustomobject]@{
  measuredAt      = (Get-Date).ToString('s')
  processes       = $processes.Count
  privateMB       = [math]::Round($private / 1MB, 1)
  workingSetMB    = [math]::Round($working / 1MB, 1)
  frontendReadyMs = $frontendReady
} | ConvertTo-Json -Compress
