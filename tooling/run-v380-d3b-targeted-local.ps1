# D3b-0 TARGETED fixture (actual v20 SQL triggers on a synthetic v19 base), NOT full-v20 applied migration.
# This script never connects to an existing service, Neon or production.
# FlyTally D3b targeted native PostgreSQL 16 characterization on a disposable local cluster.
# Windows PowerShell 5.1 safe (ASCII). Requires Git, Node 24, PostgreSQL 16 binaries.
# Does NOT touch the pre-existing server on port 55432 or Neon/Vercel.
# Run: powershell -ExecutionPolicy Bypass -File .\tooling\run-v380-d3b-targeted-local.ps1
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$expectedBranch = "analysis/3.8.0-d3b-protected-trash-evidence"
$oldPath = $env:Path
$oldDatabaseUrl = [Environment]::GetEnvironmentVariable("DATABASE_URL", "Process")
$oldPgIntegration = [Environment]::GetEnvironmentVariable("FLYTALLY_POSTGRES_INTEGRATION", "Process")
$oldD3bTargetedPg16 = [Environment]::GetEnvironmentVariable("FLYTALLY_D3B_TARGETED_PG16_DISPOSABLE", "Process")
$oldPgPassword = [Environment]::GetEnvironmentVariable("PGPASSWORD", "Process")
$temporaryRoot = $null
$dataDir = $null
$started = $false
$startupAttempted = $false
$mayDeleteTemporaryRoot = $false

function Assert-Exit([string]$step) {
  if ($LASTEXITCODE -ne 0) { throw "$step failed (exit code $LASTEXITCODE)." }
}
function Restore-Env([string]$name, [string]$value) {
  [Environment]::SetEnvironmentVariable($name, $value, "Process")
}

Write-Host "FlyTally D3b native PG16 targeted Trash lifecycle reproduction" -ForegroundColor Cyan
Push-Location $repoPath
try {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Git is not on PATH." }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node 24 is not on PATH." }
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm is not on PATH." }
  $currentBranch = (& git branch --show-current).Trim()
  Assert-Exit "Git branch read"
  if ($currentBranch -ne $expectedBranch) { throw "Wrong branch: $currentBranch. Expected $expectedBranch." }
  # Exact candidate: tracked content MUST be clean. Do not delete, stash or
  # reclassify the owner's unrelated untracked files.
  $dirtyTracked = & git status --porcelain --untracked-files=no
  Assert-Exit "Git tracked-file status"
  if ($dirtyTracked) {
    throw "Tracked files have uncommitted changes. Stop before creating a test cluster."
  }
  $untrackedFiles = @(& git ls-files --others --exclude-standard)
  Assert-Exit "Git untracked-file inventory"
  # tsconfig includes **/*.ts and **/*.tsx; an untracked TypeScript file
  # could affect typecheck and invalidate exact-commit verification evidence.
  $untrackedTypescript = @($untrackedFiles | Where-Object { $_ -match '(?i)\.(?:ts|tsx)$' })
  if ($untrackedTypescript.Count -gt 0) {
    throw "Untracked TypeScript files may affect the exact-candidate typecheck. Use a separate clean worktree for testing."
  }
  if ($untrackedFiles.Count -gt 0) {
    Write-Host "Ignoring $($untrackedFiles.Count) unrelated untracked file(s); none will be deleted or modified."
  }
  $commit = (& git rev-parse HEAD).Trim()
  Assert-Exit "Git commit identity"
  if (-not ((& node --version) -match '^v24\.')) { throw "Node 24.x required." }
  Write-Host "Candidate: $commit"

  # Fast, DB-independent gates first. Avoid creating and starting an isolated
  # cluster for an already broken TypeScript/source contract.
  npm run typecheck
  Assert-Exit "TypeScript"
  npm run test:target -- tests/integration/v380-d3b-trash-source-characterization.test.ts
  Assert-Exit "D3b source characterization tests"

  $pgBin = Join-Path $env:ProgramFiles "PostgreSQL\16\bin"
  foreach ($program in @("initdb.exe","pg_ctl.exe","createdb.exe","psql.exe")) {
    if (-not (Test-Path (Join-Path $pgBin $program))) {
      throw "PostgreSQL 16 tools not found in $pgBin. Cluster was not started."
    }
  }
  $env:Path = "$pgBin;$env:Path"
  $initdb = Join-Path $pgBin "initdb.exe"
  $pgctl = Join-Path $pgBin "pg_ctl.exe"
  $createdb = Join-Path $pgBin "createdb.exe"
  $psql = Join-Path $pgBin "psql.exe"

  # Acquire a free localhost port without touching the existing 55432 server.
  $portSocket = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), 0)
  $portSocket.Start()
  try { $port = $portSocket.LocalEndpoint.Port } finally { $portSocket.Stop() }
  if ($port -eq 5432) { throw "Refusing standard local PostgreSQL port 5432." }

  # Exclusive user-temp location, used only by this script. Never reuse cluster data.
  $temporaryRoot = Join-Path $env:TEMP ("flytally-d3b-targeted-" + [guid]::NewGuid().ToString("N"))
  [void](New-Item -ItemType Directory -Path $temporaryRoot)
  $dataDir = Join-Path $temporaryRoot "postgres-data"
  $logPath = Join-Path $temporaryRoot "postgres.log"

  Write-Host "Creating isolated PostgreSQL 16 cluster on 127.0.0.1:$port"
  Write-Host "Temporary data: $temporaryRoot"
  # Trust is limited to an ephemeral PostgreSQL server bound to loopback only.
  & $initdb -D $dataDir -U flytally -A trust --encoding=UTF8 --no-instructions
  Assert-Exit "Disposable initdb"
  $startupAttempted = $true
  & $pgctl -D $dataDir -l $logPath -o "-h 127.0.0.1 -p $port" -w -t 30 start
  Assert-Exit "Disposable postgres startup"
  $started = $true

  & $createdb -h 127.0.0.1 -p $port -U flytally flytally_currency_test
  Assert-Exit "Disposable database creation"
  # Fresh cluster uses localhost trust, never copies any existing DB password.
  $env:PGPASSWORD = ""
  $env:DATABASE_URL = "postgresql://flytally@127.0.0.1:$port/flytally_currency_test"
  $env:FLYTALLY_POSTGRES_INTEGRATION = "1"
  $env:FLYTALLY_D3B_TARGETED_PG16_DISPOSABLE = "1"
  # Format each database field explicitly to avoid platform-dependent scalar
  # concatenation and preserve actionable, non-secret diagnostics on mismatch.
  $identityOutput = @(& $psql -X -w -v ON_ERROR_STOP=1 -At -F "|" -d $env:DATABASE_URL -c "SELECT current_database(), current_user, host(inet_server_addr()), inet_server_port()")
  Assert-Exit "Disposable local database identity"
  $identityRows = @($identityOutput | ForEach-Object { [string]$_ } | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" })
  $expectedIdentity = "flytally_currency_test|flytally|127.0.0.1|$port"
  $observedIdentity = $identityRows -join "; "
  Write-Host "Database identity expected: [$expectedIdentity]"
  Write-Host "Database identity observed: [$observedIdentity]"
  if ($identityRows.Count -ne 1 -or $identityRows[0] -cne $expectedIdentity) {
    throw "Test database identity mismatch. PostgreSQL tests NOT RUN. No existing database was changed."
  }
  Write-Host "Verified disposable DB identity."

  npm run test:target -- tests/integration/postgres-v380-d3b-real-trash-races.test.ts
  Assert-Exit "D3b native PostgreSQL16 targeted Trash SQL / race tests"
  Write-Host "LOCAL D3b TARGETED native PG16 tests PASS on candidate $commit; full-v20 migration fidelity remains NOT RUN. Not production." -ForegroundColor Green
} finally {
  Restore-Env "DATABASE_URL" $oldDatabaseUrl
  Restore-Env "FLYTALLY_POSTGRES_INTEGRATION" $oldPgIntegration
  Restore-Env "FLYTALLY_D3B_TARGETED_PG16_DISPOSABLE" $oldD3bTargetedPg16
  Restore-Env "PGPASSWORD" $oldPgPassword
  $env:Path = $oldPath

  if ($started) {
    # Stop ONLY the unique cluster this script created. If stop fails, preserve data
    # for inspection rather than delete files belonging to a running server.
    & (Join-Path $env:ProgramFiles "PostgreSQL\16\bin\pg_ctl.exe") -D $dataDir -m fast -w -t 30 stop
    if ($LASTEXITCODE -eq 0) {
      $mayDeleteTemporaryRoot = $true
    } else {
      Write-Warning "Temporary PostgreSQL stop failed. Preserving data at $temporaryRoot for manual inspection."
    }
  } elseif ($temporaryRoot) {
    if ($startupAttempted -and (Test-Path (Join-Path $dataDir "postmaster.pid"))) {
      Write-Warning "PostgreSQL startup status unknown. Preserving $temporaryRoot for inspection."
    } else {
      $mayDeleteTemporaryRoot = $true
    }
  }
  if ($mayDeleteTemporaryRoot -and $temporaryRoot -and (Test-Path $temporaryRoot)) {
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
  }
  Pop-Location
}
