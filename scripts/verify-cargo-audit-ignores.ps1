<#
Expiry gate for the advisories `src-tauri/.cargo/audit.toml` tells cargo-audit to ignore.

cargo-audit has no notion of a review date: an ignore entry stays silent forever. The npm triage
gate already fails when an exception's reviewBy passes, and this is the same rule for Rust. Every
ignored RUSTSEC id must sit below a `reviewBy: YYYY-MM-DD` comment in its block (an entry that
shares the block above it inherits that date), and the gate fails once the date has passed.
#>
param(
  [string]$AuditTomlPath,
  # Overridable so the date handling is testable without waiting for a calendar day.
  [string]$Today
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $AuditTomlPath) {
  $AuditTomlPath = Join-Path $repoRoot "src-tauri/.cargo/audit.toml"
}
$reviewDate = if ($Today) { [datetime]::ParseExact($Today, 'yyyy-MM-dd', $null) } else { (Get-Date).Date }

$lines = [IO.File]::ReadAllLines($AuditTomlPath)
$failures = New-Object System.Collections.Generic.List[string]
$checked = 0
$currentReviewBy = $null
foreach ($line in $lines) {
  $review = [regex]::Match($line, 'reviewBy:\s*(\d{4}-\d{2}-\d{2})')
  if ($review.Success) {
    $currentReviewBy = [datetime]::ParseExact($review.Groups[1].Value, 'yyyy-MM-dd', $null)
    continue
  }
  $entry = [regex]::Match($line, '^\s*"(RUSTSEC-\d{4}-\d{4})"')
  if (-not $entry.Success) {
    continue
  }
  $checked++
  $id = $entry.Groups[1].Value
  if (-not $currentReviewBy) {
    $failures.Add("$id has no reviewBy date")
  } elseif ($currentReviewBy -lt $reviewDate) {
    $failures.Add("$id passed its reviewBy date $($currentReviewBy.ToString('yyyy-MM-dd'))")
  }
}

if ($failures.Count -gt 0) {
  throw "cargo-audit ignore triage failed:`n - $($failures -join "`n - ")"
}
Write-Output "Verified cargo-audit ignores: $checked entr$(if ($checked -eq 1) { 'y' } else { 'ies' }) within their review dates"
