# R2.1b P0-D3 local security checks — Docker-optional, SYNTHETIC ONLY.
# Run from FlyTally Logbook repo root, e.g.:
# & .\research\gps-r21-p0-d3-synthetic-security\run-local-gates.ps1 -ExpectedSha <full-SHA>
# Default runs NO database, creates NO containers and uses NO secrets.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-fA-F]{40}$')]
    [string] $ExpectedSha,

    [ValidateSet("none", "docker")]
    [string] $PostgresProvider = "none"
)

$ErrorActionPreference = "Stop"

$expectedBranch = "test/gps-r21-p0-d3-synthetic-security"
$actualBranch = (& git branch --show-current)
if ($LASTEXITCODE -ne 0 -or $actualBranch.Trim() -ne $expectedBranch) {
    throw "Expected isolated synthetic-security branch. Do not run from another branch."
}

$actualSha = (& git rev-parse HEAD)
if ($LASTEXITCODE -ne 0 -or $actualSha.Trim() -ne $ExpectedSha) {
    throw "Unexpected HEAD. Inspect PR #351 and pin the exact current SHA."
}
$workingTree = (& git status --porcelain)
if ($LASTEXITCODE -ne 0 -or $workingTree) {
    throw "Working tree is not clean; aborting before any test."
}

Write-Host "Synthetic-only research verification, SHA $actualSha"
& npm run test:target -- tests/gps-r21-p0-d3-synthetic-security.test.ts
if ($LASTEXITCODE -ne 0) { throw "Synthetic Node/static security tests FAILED" }

& npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "Repository TypeScript typecheck FAILED" }

Write-Host "PASS — synthetic Node tests and TypeScript (owner-local; not CI)"

if ($PostgresProvider -eq "none") {
    $nativeTools = @("initdb", "pg_ctl", "psql")
    $nativeFound = @($nativeTools | Where-Object { Get-Command $_ -ErrorAction SilentlyContinue })
    if ($nativeFound.Count -eq 3) {
        Write-Host "DISCOVERED — native PostgreSQL tools on PATH, but no independently verified disposable native cluster."
        Write-Host "NOT RUN — native PostgreSQL RLS (requires a separately reviewed safe ephemeral-cluster runner)."
    } else {
        Write-Host "NOT DETECTED — complete native PostgreSQL initdb/pg_ctl/psql toolchain on PATH."
    }
    Write-Host "NOT RUN — PostgreSQL role/RLS tests: no isolated DB provider selected."
    Write-Host "OVERALL P0-D3 SECURITY GATE OPEN — missing real PostgreSQL RLS evidence."
    return
}

# Explicit opt-in: optional Docker test provider, never used by the default flow.
# No fallback to an existing local PostgreSQL, application DATABASE_URL or Neon.
if ($PostgresProvider -ne "docker") {
    throw "Unsupported provider. No PostgreSQL test started."
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI unavailable; RLS NOT RUN. Do not substitute another database."
}
& docker info --format '{{.ServerVersion}}'
if ($LASTEXITCODE -ne 0) { throw "Docker engine unavailable; RLS NOT RUN" }
& docker image inspect postgres:16-alpine --format '{{.Id}}'
if ($LASTEXITCODE -ne 0) { throw "Local test image missing; RLS NOT RUN" }

# The runner additionally rejects ambient DATABASE_URL / PG* credentials,
# remote Docker contexts, missing flags and unsafe fixture initialization.
& node research/gps-r21-p0-d3-synthetic-security/run-synthetic-postgres.mjs --synthetic-only
if ($LASTEXITCODE -ne 0) { throw "Isolated synthetic PostgreSQL RLS proof FAILED" }

Write-Host "PASS — optional isolated synthetic PostgreSQL RLS probes"
Write-Host "R2.1b-P0-D3 SYNTHETIC LOCAL GATES PASS — NOT production/Neon authorization"
