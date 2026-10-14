# FlyTally 3.8.0 Currency — one-command owner-local acceptance.
# No remote DB, no migration registration, no deployment. ASCII for Windows PowerShell 5.1.
# Usage: powershell -ExecutionPolicy Bypass -File .\tooling\run-currency-380-acceptance.ps1
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Push-Location $root
try {
  $expectedBranch = "feat/3.8.0-m2a0-schema-review-main"
  $branch = (& git branch --show-current).Trim()
  if ($LASTEXITCODE -ne 0 -or $branch -ne $expectedBranch) {
    throw "Expected branch $expectedBranch; actual branch $branch."
  }
  $dirty = @(& git status --porcelain --untracked-files=no)
  if ($LASTEXITCODE -ne 0 -or $dirty.Count -gt 0) {
    throw "Tracked working tree must be clean. Commit intended changes before acceptance."
  }
  $sha = (& git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0) { throw "Could not resolve commit." }
  if (-not ((& node --version) -match '^v24\.')) { throw "Node 24.x required." }
  Write-Host "Currency 3.8.0 owner-local acceptance on $sha" -ForegroundColor Cyan
  Write-Host "Gate 1: disposable PostgreSQL 16 and targeted currency schema tests"
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "run-currency-m2a0-local.ps1")
  if ($LASTEXITCODE -ne 0) { throw "Disposable PostgreSQL gate FAILED. No later gates run." }
  Write-Host "Gate 2: complete source/unit tests"
  & npm.cmd test
  if ($LASTEXITCODE -ne 0) { throw "Full test suite FAILED." }
  Write-Host "Gate 3: production application build (local only)"
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "Local production build FAILED." }
  $end = (& git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $end -ne $sha) { throw "Candidate HEAD changed during acceptance." }
  Write-Host "LOCAL ACCEPTANCE PASS on $sha (targeted PG + all unit tests + build)." -ForegroundColor Green
  Write-Host "NOT INCLUDED: authenticated browser, complete signed v13 restore, production Neon preflight, release approval."
} finally {
  Pop-Location
}
