# FlyTally M2-A-0 acceptance: native PostgreSQL 16, disposable local test cluster.
# Windows PowerShell 5.1 safe (ASCII). Requires Git, Node 24, PostgreSQL 16 binaries.
# Does NOT touch the pre-existing server on port 55432 or Neon/Vercel.
# Run: powershell -ExecutionPolicy Bypass -File .\tooling\run-currency-m2a0-local.ps1
param([switch]$Full)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$expectedBranch = "feat/3.8.0-currency-m2a0-sql-draft"
$oldPath = $env:Path
$oldDatabaseUrl = [Environment]::GetEnvironmentVariable("DATABASE_URL", "Process")
$oldPgIntegration = [Environment]::GetEnvironmentVariable("FLYTALLY_POSTGRES_INTEGRATION", "Process")
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

Write-Host "FlyTally M2-A-0 native PostgreSQL local test" -ForegroundColor Cyan
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
  $untrackedTypescript = @($untrackedFiles | Where-Object { $_ -match '(?i)\\.(?:ts|tsx)$' })
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

  # Exclusive user-temp location, used only by this script. Never reuse cluster data.
  $temporaryRoot = Join-Path $env:TEMP ("flytally-currency-m2a0-" + [guid]::NewGuid().ToString("N"))
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
  $identity = & $psql -X -w -v ON_ERROR_STOP=1 -At -d $env:DATABASE_URL -c "SELECT current_database() || '|' || current_user || '|' || inet_server_addr() || '|' || inet_server_port()"
  Assert-Exit "Disposable local database identity"
  if ($identity.Trim() -ne "flytally_currency_test|flytally|127.0.0.1|$port") {
    throw "Test database identity mismatch. PostgreSQL tests NOT RUN."
  }
  Write-Host "Verified disposable DB identity: $identity"

  npm run typecheck
  Assert-Exit "TypeScript"
  npm run test:target -- tests/currency-v21-schema-draft.test.ts
  Assert-Exit "Static M2-A-0 tests"
  npm run test:target -- tests/integration/postgres-currency-v21-schema.test.ts
  Assert-Exit "Focused PostgreSQL M2-A-0 tests"
  if ($Full) {
    npm run test:postgres:full
    Assert-Exit "Full PostgreSQL regression"
  }
  Write-Host "LOCAL test gates PASS on candidate $commit. Not a production migration." -ForegroundColor Green
} finally {
  Restore-Env "DATABASE_URL" $oldDatabaseUrl
  Restore-Env "FLYTALLY_POSTGRES_INTEGRATION" $oldPgIntegration
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
