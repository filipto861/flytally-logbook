# Currency 3.8.0 authenticated browser Trash v20/v21 acceptance on disposable localhost PostgreSQL16.
# DESTRUCTIVE FIXTURE: run-auth-browser bootstrap DROPS public schema.
# Never point this runner at any existing local service/database or production/Neon.
# This runner exclusively creates, verifies, and destroys its OWN localhost cluster.
# Windows PowerShell 5.1; Git/Node 24/PG16 and repository Playwright browsers.
# Run: powershell -ExecutionPolicy Bypass -File .\tooling\run-currency-380-browser-local.ps1
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$expectedBranch = "feat/3.8.0-m2a0-schema-review-main"
$oldPath = $env:Path
$oldDatabaseUrl = [Environment]::GetEnvironmentVariable("DATABASE_URL", "Process")
$oldPgIntegration = [Environment]::GetEnvironmentVariable("FLYTALLY_POSTGRES_INTEGRATION", "Process")
$oldD3bTargetedPg16 = [Environment]::GetEnvironmentVariable("FLYTALLY_D3B_TARGETED_PG16_DISPOSABLE", "Process")
$oldD3bMigrationsPg16 = [Environment]::GetEnvironmentVariable("FLYTALLY_D3B_MIGRATIONS_PG16_DISPOSABLE", "Process")
$oldPgPassword = [Environment]::GetEnvironmentVariable("PGPASSWORD", "Process")
$oldAuthBrowser = [Environment]::GetEnvironmentVariable("FLYTALLY_AUTH_BROWSER", "Process")
$oldCurrencyBrowser = [Environment]::GetEnvironmentVariable("FLYTALLY_CURRENCY_V21_BROWSER", "Process")
$oldLocalPostgres = [Environment]::GetEnvironmentVariable("FLYTALLY_LOCAL_POSTGRES", "Process")
$oldSessionSecret = [Environment]::GetEnvironmentVariable("SESSION_SECRET", "Process")
$oldSigningSecret = [Environment]::GetEnvironmentVariable("SIGNING_SECRET", "Process")
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

Write-Host "FlyTally 3.8.0 Currency v20/v21 authenticated browser - disposable localhost PG16" -ForegroundColor Cyan
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

  # Refuse a pre-existing web server: Playwright must start our own Next process.
  # IMPORTANT: Next/Turbopack must compile the optimized browser build using
  # the verified disposable database and purpose flags, NOT the owner's .env.local.
  $webProbe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), 3000)
  try { $webProbe.Start() } catch { throw "Local port 3000 is already occupied. Browser test NOT RUN; stop the other server first." } finally { $webProbe.Stop() }
  if ($env:CI) { throw "CI env must be unset for this local browser gate: retries must stay zero." }
  # Auth and backups must be signed with isolated per-run test-only secrets.
  # Process environment overrides .env.local; restore it in finally.
  $env:SESSION_SECRET = ([guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N"))
  $env:SIGNING_SECRET = ([guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N"))
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
  if ($port -in @(5432,55432)) { throw "Refusing existing or standard PostgreSQL port." }

  # Exclusive user-temp location, used only by this script. Never reuse cluster data.
  $temporaryRoot = Join-Path $env:TEMP ("flytally-380-browser-" + [guid]::NewGuid().ToString("N"))
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
  $env:FLYTALLY_AUTH_BROWSER = "1"
  $env:FLYTALLY_CURRENCY_V21_BROWSER = "1"
  $env:FLYTALLY_LOCAL_POSTGRES = "1"
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

  # Production deployment markers are never valid in the disposable acceptance.
  # Fail closed rather than weakening the v21 migration guard for this test.
  if (Test-Path Env:VERCEL) { throw "VERCEL marker is present; local browser build refused." }
  if (Test-Path Env:VERCEL_ENV) { throw "VERCEL_ENV marker is present; local browser build refused." }
  # Compile AFTER the isolated DB identity and purpose flags are set. The Next
  # server uses this build with exactly the same process environment.
  npm.cmd run build
  Assert-Exit "Exact candidate Next.js build"

  # The browser harness invokes a fixture bootstrap that drops schema public;
  # DATABASE_URL above points exclusively to the newly created verified cluster.
  npm.cmd run test:browser -- e2e/trash-integrity.spec.mjs
  Assert-Exit "Currency 3.8.0 authenticated desktop/mobile Trash-integrity acceptance"
  Write-Host "LOCAL CURRENCY 3.8 AUTH BROWSER PASS on $commit with disposable localhost database only; full signed portable v13 recovery and production Neon remain OPEN. Not production." -ForegroundColor Green
} finally {
  Restore-Env "DATABASE_URL" $oldDatabaseUrl
  Restore-Env "FLYTALLY_POSTGRES_INTEGRATION" $oldPgIntegration
  Restore-Env "FLYTALLY_D3B_TARGETED_PG16_DISPOSABLE" $oldD3bTargetedPg16
  Restore-Env "FLYTALLY_D3B_MIGRATIONS_PG16_DISPOSABLE" $oldD3bMigrationsPg16
  Restore-Env "PGPASSWORD" $oldPgPassword
  Restore-Env "FLYTALLY_AUTH_BROWSER" $oldAuthBrowser
  Restore-Env "FLYTALLY_CURRENCY_V21_BROWSER" $oldCurrencyBrowser
  Restore-Env "FLYTALLY_LOCAL_POSTGRES" $oldLocalPostgres
  Restore-Env "SESSION_SECRET" $oldSessionSecret
  Restore-Env "SIGNING_SECRET" $oldSigningSecret
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
