# R2.1b P0-D3 E1a standalone local verification - NO Docker / NO DB.
# Example (from any folder):
# & .\research\gps-r21-p0-d3-synthetic-security\run-local-gates-e1a.ps1 -ExpectedSha <40-hex-SHA>
# Does NOT replace or modify the original D3 run-local-gates.ps1 branch guard.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-fA-F]{40}$')]
    [string] $ExpectedSha
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Push-Location $repoRoot
try {
    $expectedBranch = "fix/gps-r21-p0-d3-e1a-mock-docker"
    $actualBranch = (& git branch --show-current)
    if ($LASTEXITCODE -ne 0 -or $actualBranch.Trim() -ne $expectedBranch) {
        throw "Wrong E1a research branch. No test started."
    }

    $actualSha = (& git rev-parse HEAD)
    if ($LASTEXITCODE -ne 0 -or $actualSha.Trim() -ne $ExpectedSha) {
        throw "Unexpected E1a HEAD. Supply the verified 40-character SHA."
    }
    $workingTree = (& git status --porcelain --untracked-files=all)
    if ($LASTEXITCODE -ne 0 -or $workingTree) {
        throw "Working tree is not clean. No test started."
    }

    # Guard against accidentally testing with inherited connection settings.
    # Never print variable values; fail before invoking Node or npm.
    $unsafe = @(Get-ChildItem Env: | Where-Object {
        $_.Value -and (
            $_.Name -match '^PG[A-Z0-9_]*$' -or
            $_.Name -in @("DATABASE_URL", "DIRECT_URL", "NEON_DATABASE_URL",
                          "DOCKER_CONTEXT", "DOCKER_HOST")
        )
    })
    if ($unsafe.Count -gt 0) {
        throw "Ambient database or Docker override detected. Clear it before E1a offline checks."
    }

    Write-Host "E1a synthetic-only offline gate, clean SHA $actualSha"
    & node --check research/gps-r21-p0-d3-synthetic-security/container-guards.mjs
    if ($LASTEXITCODE -ne 0) { throw "E1a guard syntax FAILED" }
    & node --check research/gps-r21-p0-d3-synthetic-security/run-synthetic-postgres.mjs
    if ($LASTEXITCODE -ne 0) { throw "E1a runner syntax FAILED" }

    & npm run test:target -- tests/gps-r21-p0-d3-synthetic-security.test.ts tests/gps-r21-p0-d3-e1a-fake-docker.test.ts
    if ($LASTEXITCODE -ne 0) { throw "E1a targeted Node tests FAILED" }

    & npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw "E1a TypeScript typecheck FAILED" }

    Write-Host "PASS - E1a local syntax, targeted Node and TypeScript (not CI)"
    Write-Host "NOT RUN - Docker, PostgreSQL SQL, role/RLS or any external database"
    Write-Host "OVERALL P0-D3 SECURITY GATE OPEN - real PostgreSQL RLS not executed"
} finally {
    Pop-Location
}
