# FlyTally M0-B — Windows 11, six fresh owned PostgreSQL16 clusters, 164 tests.
# Run from a clean checkout of Draft PR #469. NEVER use production or remote DB.
# Requires Windows PowerShell 5.1+, Git, Node 24.x, PostgreSQL 16 installed at
# C:\Program Files\PostgreSQL\16\bin. No admin shell / Docker / Neon needed.
param(
  [switch]$PreflightOnly,
  [switch]$SkipNpmCi
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$branch = "feat/logbook-m0b-v22-expand-candidate-20261104"
$mainSha = "c9c2f60303236113a223942072311f5e37f876f7"
$originBranch = "refs/remotes/origin/$branch"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backup = @{}
$clearNames = @()
$originalDirectory = (Get-Location).Path

function Require-Success([string]$name) {
  if ($LASTEXITCODE -ne 0) {
    throw "$name failed (exit code $LASTEXITCODE). No PG16 acceptance PASS."
  }
}
function Get-GitValue([string[]]$args, [string]$label) {
  $value = (& git @args | Out-String).Trim()
  Require-Success $label
  return $value
}

Push-Location $root
try {
  if ($env:OS -ne "Windows_NT") { throw "This runner requires local Windows." }
  foreach ($flag in @("CI","VERCEL","VERCEL_ENV")) {
    if (Test-Path ("Env:" + $flag)) { throw "Refusing $flag environment: run on an ordinary local Windows session." }
  }
  foreach ($exe in @("git","node","npm.cmd")) {
    if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { throw "$exe is not installed/on PATH." }
  }
  $nodeVersion = (& node --version | Out-String).Trim()
  Require-Success "Node version"
  if ($nodeVersion -notmatch '^v24\.') { throw "Node 24.x required, installed: $nodeVersion" }

  # Verify exact repository and work branch before touching any database.
  $remote = Get-GitValue @("remote","get-url","origin") "Git remote"
  if ($remote -cnotmatch '^(?:https://github\.com/|git@github\.com:|ssh://git@github\.com/)filipto861/flytally-logbook(?:\.git)?/?$') {
    throw "Unexpected Git origin: $remote. Refusing to run."
  }
  $actualBranch = Get-GitValue @("branch","--show-current") "Git branch"
  if ($actualBranch -cne $branch) { throw "Expected Draft #469 branch $branch; got $actualBranch." }

  $changed = @(& git status --porcelain --untracked-files=all)
  Require-Success "Git clean checkout"
  if ($changed.Count -ne 0) {
    throw "Working tree is not clean. Commit or move your own changes elsewhere; this script does not stash/reset them."
  }
  # Fetch ONLY the approved branch and canonical main; never switch/merge.
  & git fetch --no-tags origin ("+refs/heads/" + $branch + ":" + $originBranch) ("+refs/heads/main:refs/remotes/origin/main")
  Require-Success "Git read-only fetch"
  $head = Get-GitValue @("rev-parse","HEAD") "Git work SHA"
  $remoteHead = Get-GitValue @("rev-parse","--verify",$originBranch) "Git origin branch SHA"
  $remoteMain = Get-GitValue @("rev-parse","--verify","refs/remotes/origin/main") "Git canonical main SHA"
  if ($head -cne $remoteHead) {
    throw "Local checkout is stale ($head). Fetch/switch with --ff-only to $remoteHead, then rerun."
  }
  if ($remoteMain -cne $mainSha) {
    throw "Canonical main changed ($remoteMain). Stop: checkpoint/base needs new review."
  }
  if ($head -notmatch '^[a-f0-9]{40}$') { throw "Invalid candidate SHA." }

  $pgBin = Join-Path $env:ProgramFiles "PostgreSQL\16\bin"
  foreach ($name in @("initdb.exe","pg_ctl.exe","createdb.exe","psql.exe")) {
    if (-not (Test-Path (Join-Path $pgBin $name) -PathType Leaf)) {
      throw "Native PostgreSQL 16 missing: $(Join-Path $pgBin $name). No test DB created."
    }
  }
  $pgVersion = (& (Join-Path $pgBin "psql.exe") --version | Out-String).Trim()
  Require-Success "psql version"
  if ($pgVersion -notmatch 'PostgreSQL\)\s+16\.') {
    throw "Expected PostgreSQL 16 CLI, observed: $pgVersion"
  }

  Write-Host "FlyTally local PG16 acceptance preflight verified:" -ForegroundColor Cyan
  Write-Host "  Repo:  filipto861/flytally-logbook (PR #469, unmerged)"
  Write-Host "  Work:  $head"
  Write-Host "  Main:  $remoteMain"
  Write-Host "  Node:  $nodeVersion"
  Write-Host "  PG16:  $pgVersion"
  Write-Host "  Target: six NEW localhost PG16 clusters; never Neon/existing local service"

  # Source-only inventory gate runs before npm installs or a database exists.
  & node tooling/validate-postgres-partition-registry.mjs
  Require-Success "Canonical 42-file, 164-test partition registry"

  if ($PreflightOnly) {
    Write-Host "PREFLIGHT PASS — PostgreSQL tests NOT RUN." -ForegroundColor Green
    return
  }

  if (-not $SkipNpmCi) {
    Write-Host "Installing exact npm lockfile dependencies with npm ci..."
    & npm.cmd ci
    Require-Success "npm ci"
  }

  # Strip every inherited database connection variable and old test intent
  # ONLY in this PowerShell child process. Restore all in finally.
  $clearNames = @(
    [Environment]::GetEnvironmentVariables("Process").Keys |
      ForEach-Object { [string]$_ } |
      Where-Object {
        $_ -match '^(PG[A-Z0-9_]*|.*DATABASE.*|.*NEON.*|.*POSTGRES.*)$' -or
        $_ -match '^FLYTALLY_(OWNED_PG16_|PR340_PARTITION_RELEASE|POSTGRES_INTEGRATION|D2_FULL_V20_DISPOSABLE|V21_RELEASE_DISPOSABLE|D3B_)'
      } |
      Select-Object -Unique
  )
  foreach ($name in @($clearNames + @("FLYTALLY_OWNED_PG16_RELEASE","FLYTALLY_OWNED_PG16_EXPECTED_REF") | Select-Object -Unique)) {
    $backup[$name] = [Environment]::GetEnvironmentVariable($name,"Process")
    [Environment]::SetEnvironmentVariable($name,$null,"Process")
  }
  $env:FLYTALLY_OWNED_PG16_RELEASE = "1"
  $env:FLYTALLY_OWNED_PG16_EXPECTED_REF = $originBranch

  # The authoritative owned executor creates six distinct local PG16
  # clusters, validates loopback/user/port/version, runs 164 tests with
  # hash-pinned registry and preserves its temporary TAP evidence.
  Write-Host "Running 164 canonical PostgreSQL16 cases on six disposable localhost clusters..."
  & npm.cmd run verify:postgres -- --base origin/main
  Require-Success "Canonical six-partition PG16 acceptance"

  $last = Get-GitValue @("rev-parse","HEAD") "Final work SHA"
  if ($last -cne $head) { throw "Work HEAD changed during acceptance. Evidence INVALID." }
  $status = @(& git status --porcelain --untracked-files=all)
  Require-Success "Final worktree identity"
  if ($status.Count -ne 0) { throw "Worktree changed during test execution. Evidence INVALID." }
  Write-Host "LOCAL PG16 164/164 acceptance PASS for exact SHA $head" -ForegroundColor Green
  Write-Host "Use verified-summary.json from the executor's printed %TEMP% evidence directory for the checkpoint."
  Write-Host "This is NOT a merge, deploy, Neon/HTTP parity test, or permission to activate V22."
}
finally {
  foreach ($name in $backup.Keys) {
    [Environment]::SetEnvironmentVariable($name,$backup[$name],"Process")
  }
  Pop-Location
}
