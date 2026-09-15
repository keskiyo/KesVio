$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$smokePath = Join-Path $repoRoot "scripts/run-native-smoke.ps1"

if (-not (Test-Path -LiteralPath $smokePath -PathType Leaf)) {
  throw "Native smoke harness not found"
}

$source = [IO.File]::ReadAllText($smokePath, [Text.Encoding]::UTF8)

# The harness runs a real executable on the developer's machine, so its safety is a contract: it
# works only inside a workspace of its own, stops only the process it started there, and reads
# the per-user stores solely to prove they were left alone.
foreach ($requiredPattern in @(
  '\$workspace = Join-Path \$WorkspaceRoot \$stamp',
  '\$dataRoot = Join-Path \$appDirectory "KesVioData"',
  'if \(-not \$livePath\.StartsWith\(\$appDirectory, \[StringComparison\]::OrdinalIgnoreCase\)\) \{\s*throw "Refusing to stop a process outside the smoke workspace"',
  'Remove-Item -LiteralPath \$workspace -Recurse -Force',
  'perUserData = Join-Path \$env:APPDATA "keskiyo\.kesvio"',
  'installedCopy = Join-Path \$env:LOCALAPPDATA "KesVio"',
  'Add-Result -Step "per-user and installed stores untouched"',
  'throw "Another KesVio process is running'
)) {
  if ($source -notmatch $requiredPattern) {
    throw "Native smoke harness is missing $requiredPattern"
  }
}

$stopCalls = [regex]::Matches($source, 'Stop-Process[^\r\n]*')
if ($stopCalls.Count -ne 1 -or $stopCalls[0].Value -ne 'Stop-Process -Id $Target.Id -Force') {
  throw "Native smoke harness must stop only the process it started, by the id it recorded"
}
$removeCalls = [regex]::Matches($source, 'Remove-Item[^\r\n]*')
if ($removeCalls.Count -ne 1 -or $removeCalls[0].Value -notmatch '^Remove-Item -LiteralPath \$workspace ') {
  throw "Native smoke harness must delete only its own workspace"
}
if ($source -match 'taskkill|HKLM:|HKCU:|Set-ItemProperty|New-ItemProperty|reg\.exe|Registry::') {
  throw "Native smoke harness must not touch the registry or other processes"
}
foreach ($forbiddenWrite in @('\$env:APPDATA', '\$env:LOCALAPPDATA', '\$env:ProgramFiles')) {
  foreach ($line in ($source -split "`n")) {
    if ($line -match $forbiddenWrite -and $line -match 'WriteAllText|Set-Content|Out-File|Copy-Item|New-Item|CreateDirectory') {
      throw "Native smoke harness must not write under $forbiddenWrite"
    }
  }
}

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
  $output = & powershell -NoProfile -File $smokePath `
    -ExecutablePath (Join-Path $repoRoot "missing.exe") 2>&1 | Out-String
  $exitCode = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $previousErrorActionPreference
}

if ($exitCode -eq 0) {
  throw "Native smoke harness accepted a missing executable"
}
if ($output -notmatch "Native smoke executable not found") {
  throw "Native smoke harness did not return the static executable error"
}

Write-Output "Verified native smoke harness safety contract"
