# FlyTally Logbook D1-V11 — candidate-bound FAST local gate.
# Non-destructive. DOES NOT run PostgreSQL integration/benchmark, browser fixtures,
# GitHub merge, deployment, or production database commands.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File .\tooling\run-d1-v11-fast-local.ps1 -ExpectedSha <40-char-head>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-fA-F]{40}$')][string]$ExpectedSha,
  [switch]$InstallDependencies
)
$ErrorActionPreference = 'Stop'
$branch = 'feat/logbook-d1-v11-editorial-preview-20261024'
$mainSha = '470656f01ce9d8999d7dff5dbf3a2474c7b2e4d9'
$logRoot = Join-Path $env:TEMP 'FlyTally-V11-Local-Gates'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$log = Join-Path $logRoot ("v11-" + $ExpectedSha.Substring(0,12) + "-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.txt')
Start-Transcript -Path $log -Force | Out-Null
try {
  Write-Host "FlyTally D1-V11 FAST GATES"
  Write-Host "Expected work SHA: $ExpectedSha"
  Write-Host "Log: $log"
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git not installed.' }
  if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm.cmd not installed.' }
  $repo = (& git rev-parse --show-toplevel 2>&1)
  if ($LASTEXITCODE -ne 0) { throw 'Run this script inside your cloned flytally-logbook repository.' }
  $repo = ($repo | Out-String).Trim()
  Set-Location $repo
  if (-not (Test-Path 'AGENTS.md') -or -not (Test-Path 'tooling\run-d1-v11-fast-local.ps1')) { throw 'Unexpected repository root.' }
  $currentBranch = (& git branch --show-current).Trim()
  if ($currentBranch -ne $branch) { throw "Wrong branch: $currentBranch. Expected: $branch. Switch branches manually first." }
  $head = (& git rev-parse HEAD).Trim()
  if ($head -ne $ExpectedSha) { throw "Wrong HEAD: $head. Expected: $ExpectedSha. Pull the branch and retry." }
  if ((& git status --porcelain --untracked-files=no | Out-String).Trim()) { throw 'Tracked working tree is dirty. Commit or stash first.' }
  & git fetch --quiet origin main $branch
  if ($LASTEXITCODE -ne 0) { throw 'Git fetch failed.' }
  $remoteBranch = (& git rev-parse "refs/remotes/origin/$branch").Trim()
  $remoteMain = (& git rev-parse 'refs/remotes/origin/main').Trim()
  if ($remoteBranch -ne $ExpectedSha) { throw "Remote PR moved to $remoteBranch; exact-SHA gate aborted." }
  if ($remoteMain -ne $mainSha) { throw "Canonical main changed to $remoteMain; reconcile candidate base before testing." }
  $nodeVer = (& node --version).Trim()
  if ($nodeVer -notmatch '^v24\.') { throw "Node 24.x required; found $nodeVer." }
  Write-Host "IDENTITY PASS: branch=$branch work=$head main=$remoteMain node=$nodeVer"
  if ($InstallDependencies -or -not (Test-Path 'node_modules\.package-lock.json')) {
    Write-Host "Installing exactly package-lock dependencies (npm ci)"
    & npm.cmd ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed (exit $LASTEXITCODE)." }
  }
  function Invoke-Gate([string]$Name,[string[]]$Arguments) {
    Write-Host ""
    Write-Host "===== GATE: $Name ====="
    & npm.cmd @Arguments
    $code = $LASTEXITCODE
    if ($code -ne 0) { throw "$Name FAILED (exit $code). Stop; remaining gates NOT RUN." }
    Write-Host "===== $Name PASS ====="
  }
  Invoke-Gate 'D1-V11 targeted source/domain tests' @(
    'run','test:target','--',
    'tests/d1-v11-dashboard-pace.test.ts',
    'tests/d1-v11-dashboard-bounded-read.test.ts',
    'tests/v230-large-logbook-performance.test.ts',
    'tests/v1341-dashboard-customization.test.ts',
    'tests/v170-dashboard-statistics-ux.test.ts',
    'tests/logbook-n2b-workspace-layout.test.ts'
  )
  Invoke-Gate 'TypeScript project' @('run','typecheck')
  Invoke-Gate 'Next production build (no deploy)' @('run','build')
  Invoke-Gate 'Candidate risk plan (read-only)' @('run','verify:plan','--','--base','origin/main')
  $final = (& git rev-parse HEAD).Trim()
  if ($final -ne $ExpectedSha) { throw "HEAD changed after gates: $final." }
  Write-Host ""
  Write-Host "FAST GATES PASS for exact HEAD $final"
  Write-Host "NOT RUN: PostgreSQL 100k/EXPLAIN ANALYZE, authenticated browser, iPad Safari, CI/production smoke."
  Write-Host "DO NOT merge/deploy; attach this log for review and remaining gates."
}
catch {
  Write-Host ("FAST GATES FAILED / BLOCKED: " + $_.Exception.Message) -ForegroundColor Red
  Write-Host "Do not merge or deploy. Upload log: $log"
  exit 1
}
finally {
  Stop-Transcript | Out-Null
}
