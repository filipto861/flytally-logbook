# FlyTally Logbook 3.8.0 M2-A-0: disposable, LOCAL-only PostgreSQL acceptance.
# Docker Desktop + Git for Windows required. PostgreSQL and Node 24 run in Docker.
# Usage: powershell -ExecutionPolicy Bypass -File .\tooling\run-currency-m2a0-docker.ps1
# Optional: -Full runs ALL existing PostgreSQL integration suites.
param([switch]$Full)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$repoPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$expectedBranch = "feat/3.8.0-currency-m2a0-sql-draft"
$container = "ft-currency-pg-" + [guid]::NewGuid().ToString("N").Substring(0,12)
$dbName = "flytally_currency_test"
$dbUser = "ftcurrency"
$dbPassword = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
$created = $false

function Assert-LastExit([string]$label) {
  if ($LASTEXITCODE -ne 0) { throw "$label failed (exit code $LASTEXITCODE)." }
}

Write-Host "FlyTally 3.8.0 Currency - isolated PostgreSQL acceptance" -ForegroundColor Cyan
Push-Location $repoPath
try {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Git for Windows is required." }
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker Desktop is required." }
  $branch = (& git branch --show-current).Trim()
  Assert-LastExit "git branch"
  if ($branch -ne $expectedBranch) { throw "Wrong branch '$branch'. Switch to $expectedBranch first." }
  $dirty = & git status --porcelain --untracked-files=normal
  Assert-LastExit "git status"
  if ($dirty) { throw "Uncommitted changes detected. Commit or stash before exact-candidate tests." }
  $commit = (& git rev-parse HEAD).Trim()
  Assert-LastExit "git rev-parse"
  Write-Host "Candidate commit: $commit"
  & docker info --format '{{.ServerVersion}}' | Out-Null
  Assert-LastExit "Docker daemon check"
  & docker run --detach --rm --name $container -e "POSTGRES_USER=$dbUser" -e "POSTGRES_PASSWORD=$dbPassword" -e "POSTGRES_DB=$dbName" postgres:16-alpine | Out-Null
  Assert-LastExit "Disposable PostgreSQL start"
  $created = $true
  $ready = $false
  for ($i=0; $i -lt 50; $i++) {
    & docker exec $container pg_isready -q -U $dbUser -d $dbName 2>$null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) {
    & docker logs $container --tail 40
    throw "Disposable PostgreSQL failed readiness."
  }
  # Shared PRIVATE network namespace: no Postgres port is published to Windows.
  # Read-only source volume + temporary /work means npm ci never touches Windows node_modules.
  $databaseUrl = "postgresql://" + $dbUser + ":" + $dbPassword + "@127.0.0.1:5432/" + $dbName
  $steps = @(
    "set -e",
    "mkdir -p /work",
    "tar -C /source --exclude=.git --exclude=node_modules --exclude=.next --exclude=.turbo -cf - . | tar -C /work -xf -",
    "cd /work",
    "apt-get update -qq",
    "DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql-client >/dev/null",
    "node --version",
    "psql --version",
    "npm ci --no-audit --no-fund",
    "npm run typecheck",
    "npm run test:target -- tests/currency-v21-schema-draft.test.ts",
    "npm run test:target -- tests/integration/postgres-currency-v21-schema.test.ts"
  )
  if ($Full) { $steps += "npm run test:postgres:full" }
  $shellScript = $steps -join [Environment]::NewLine
  Write-Host "Running Node 24 and PostgreSQL tests in disposable containers."
  & docker run --rm --network "container:$container" --mount "type=bind,source=$repoPath,target=/source,readonly" -w /work -e "DATABASE_URL=$databaseUrl" -e "FLYTALLY_POSTGRES_INTEGRATION=1" -e "NODE_ENV=test" node:24-bookworm bash -ec $shellScript
  Assert-LastExit "M2-A-0 local test gate"
  Write-Host "LOCAL PASS for candidate $commit; this is not CI or production." -ForegroundColor Green
} finally {
  if ($created) { & docker rm -f $container 2>$null | Out-Null }
  Pop-Location
}
