$ErrorActionPreference = "Stop"

$sourceRoot = "src-tauri/src"
if (-not (Test-Path -LiteralPath $sourceRoot)) {
  throw "Unsafe scan path does not exist: $sourceRoot"
}

# Every `unsafe` block, function or impl needs a `// SAFETY:` rationale. A rationale covers the
# contiguous run of statements below it, so two adjacent closes justified together pass; the
# search walks up and stops at a blank line or a scope boundary. An `unsafe fn` may instead state
# its caller contract in the first lines of its body.
$violations = New-Object System.Collections.Generic.List[string]

Get-ChildItem -LiteralPath $sourceRoot -Recurse -File -Filter "*.rs" | ForEach-Object {
  $file = $_
  $lines = Get-Content -LiteralPath $file.FullName
  for ($index = 0; $index -lt $lines.Count; $index++) {
    $line = $lines[$index]
    if ($line -match '^\s*//') { continue }
    $code = ($line -replace '"([^"\\]|\\.)*"', '""') -replace '//.*$', ''
    if ($code -notmatch '\bunsafe\b') { continue }
    $justified = $false
    for ($above = $index; $above -ge 0; $above--) {
      $text = $lines[$above].Trim()
      if ($text -match '^// SAFETY:' -or ($above -eq $index -and $text -match '// SAFETY:')) {
        $justified = $true
        break
      }
      if ($above -lt $index) {
        if ($text -eq '') { break }
        if ($text -match '^//') { continue }
        if ($text -match '[{}]$') { break }
      }
    }
    if (-not $justified -and $code -match '\bunsafe\b.*\bfn\b') {
      $last = [Math]::Min($lines.Count - 1, $index + 6)
      for ($below = $index + 1; $below -le $last; $below++) {
        if ($lines[$below].Trim() -match '^// SAFETY:') {
          $justified = $true
          break
        }
      }
    }
    if (-not $justified) {
      $relative = (Resolve-Path -LiteralPath $file.FullName -Relative) -replace '\\', '/' -replace '^\./', ''
      $violations.Add(("{0}:{1}: {2}" -f $relative, ($index + 1), $line.Trim()))
    }
  }
}

if ($violations.Count -gt 0) {
  throw "unsafe without an adjacent // SAFETY: rationale:`n$($violations -join "`n")"
}

Write-Output "Verified a SAFETY rationale beside every unsafe block, function and impl"
