# H4: freeze and run the actual production v20 application over disposable v21 schema.
# This separate runner uses the proven currency PG16 guard/fixture and verifies
# authenticated v20 reads/writes via the frozen v20 browser tests. NEVER remote.
# Usage: powershell -ExecutionPolicy Bypass -File .\tooling\run-currency-380-h4-v20-rollback-local.ps1
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
$worktreeAdded = $false
$oldWorktree = $null
$frozenV20Sha = "dcc8ebbfda0eadfa01345cd875ef1db806a19e26"

function Assert-Exit([string]$step) {
  if ($LASTEXITCODE -ne 0) { throw "$step failed (exit code $LASTEXITCODE)." }
}
function Restore-Env([string]$name, [string]$value) {
  [Environment]::SetEnvironmentVariable($name, $value, "Process")
}

Write-Host "FlyTally 3.8.0 H4: frozen production v20 against disposable v21 PG16" -ForegroundColor Cyan
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
  # Next/Turbopack builds against the verified disposable environment, not the
  # owner's .env.local. The harness applies v20/v21 before starting Next.
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

  # Confirm actual native Node child process inherited purpose flags before
  # Next build, npm, Playwright, or any destructive fixture bootstrap.
  & node -e "const e=process.env; if(e.FLYTALLY_AUTH_BROWSER!=='1'||e.FLYTALLY_LOCAL_POSTGRES!=='1'||e.FLYTALLY_CURRENCY_V21_BROWSER!=='1'||e.VERCEL!==undefined||e.VERCEL_ENV!==undefined){console.error('Currency purpose flags did not reach Node.'); process.exit(3);} console.log('Currency browser PowerShell-to-Node purpose preflight PASS.')"
  Assert-Exit "Currency purpose environment preflight"
  # Production deployment markers are never valid in the disposable acceptance.
  # Fail closed rather than weakening the v21 migration guard for this test.
  if (Test-Path Env:VERCEL) { throw "VERCEL marker is present; local browser build refused." }
  if (Test-Path Env:VERCEL_ENV) { throw "VERCEL_ENV marker is present; local browser build refused." }
  # Bootstrap ONLY the freshly created and identity-verified local test DB.
  # Source fixture is intentionally the same as the accepted Currency browser gate.
  & node (Join-Path $repoPath "tooling\bootstrap-browser-smoke-db.mjs")
  Assert-Exit "H4 disposable v19 bootstrap"
  # The shared 3.8 browser seed models only the surfaces its tests use.
  # Add the FROZEN v20 database-workspace projection fields absent in that
  # seed so H4 does not mistake a test-fixture omission for a v21 regression.
  # This SQL is on the owned disposable loopback database only; real v20 app
  # queries were inventoried from frozen lib/data/database.ts before addition.
  $v20WorkspaceFixture = @'
ALTER TABLE rates ADD COLUMN aircraft_type TEXT NOT NULL DEFAULT '';
ALTER TABLE rates ADD COLUMN dry_price_per_hour NUMERIC;
ALTER TABLE rates ADD COLUMN source TEXT NOT NULL DEFAULT '';
ALTER TABLE airports ADD COLUMN municipality TEXT NOT NULL DEFAULT '';
ALTER TABLE airports ADD COLUMN iso_country TEXT NOT NULL DEFAULT '';
CREATE TABLE aircraft_photos(
  aircraft_id BIGINT NOT NULL, user_id BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(aircraft_id,user_id)
);
INSERT INTO rates(user_id,registration,aircraft_type,valid_from,price_per_hour,dry_price_per_hour,source)
VALUES(9001,'OK-E2E','B23','2026-01-01',1320.50,1150.25,'manual');
'@
  & $psql -X -w -v ON_ERROR_STOP=1 -d $env:DATABASE_URL -c $v20WorkspaceFixture
  Assert-Exit "H4 frozen v20 workspace baseline fixture"

  & node (Join-Path $repoPath "tooling\apply-currency-v21-disposable.mjs")
  Assert-Exit "H4 canonical schema-first v20/v21 staging"

  # Refuse unexpected schema drift before executing any old application code.
  $checkSql = "SELECT (SELECT count(*) FROM flytally_schema_migrations WHERE version=21 AND name='source-backed currency exact-money') || '|' || (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('currency_code','currency_minor_units','price_per_hour_decimal','dry_price_per_hour_decimal','default_price_currency_code','default_price_currency_minor_units','default_price_per_hour_decimal','price_currency_code','price_currency_minor_units','amount_encoding','amount_minor_units')) || '|' || (SELECT count(*) FROM pg_constraint WHERE convalidated AND conname IN ('rates_exact_currency_tuple_v21_check','aircraft_exact_currency_tuple_v21_check','flights_exact_currency_tuple_v21_check','expenses_amount_encoding_v21_check'))"
  $shape = (& $psql -X -w -v ON_ERROR_STOP=1 -qAt -d $env:DATABASE_URL -c $checkSql).Trim()
  Assert-Exit "H4 v21 schema identity"
  if ($shape -cne "1|12|4") { throw "H4 v21 schema mismatch ($shape). Old runtime NOT RUN." }

  # Git worktree is detached at the exact Vercel production SHA, not moving main.
  & git cat-file -e "$frozenV20Sha^{commit}"
  Assert-Exit "Frozen production v20 SHA availability"
  $oldWorktree = Join-Path $temporaryRoot "frozen-v20"
  & git worktree add --detach $oldWorktree $frozenV20Sha
  Assert-Exit "Detached frozen v20 worktree creation"
  $worktreeAdded = $true
  $actualV20Sha = (& git -C $oldWorktree rev-parse HEAD).Trim()
  Assert-Exit "Frozen worktree SHA"
  if ($actualV20Sha -cne $frozenV20Sha) { throw "Unexpected old application commit; abort H4." }
  if (Test-Path (Join-Path $oldWorktree ".env.local")) { throw "Frozen checkout has .env.local; abort H4." }
  $frozenPlan = Get-Content (Join-Path $oldWorktree "lib\migration-plan.ts") -Raw
  if ($frozenPlan -notmatch 'DATABASE_SCHEMA_VERSION=20;' -or $frozenPlan -match 'version:21') {
    throw "Frozen checkout migration version changed; abort H4."
  }
  Write-Host "Frozen v20 application pinned at $actualV20Sha; v21 schema preflight PASS."

  # Only the TEST CONFIG and an extra H4 read smoke are copied into the
  # throwaway checkout. Its tracked application source remains untouched.
  $h4Config = @'
import config from "./playwright.config.mjs";
export default {...config,retries:0,webServer:{...config.webServer,reuseExistingServer:false}};
'@
  Set-Content -LiteralPath (Join-Path $oldWorktree "playwright.h4.config.mjs") -Value $h4Config -Encoding Ascii
  Copy-Item -LiteralPath (Join-Path $repoPath "e2e\v380-h4-frozen-v20.spec.mjs") -Destination (Join-Path $oldWorktree "e2e\v380-h4-frozen-v20.spec.mjs")

  # Old runtime must not inherit the v21-test auto-DDL purpose bit. v21 is
  # already registered; frozen v20 must ignore its higher migration version.
  Remove-Item Env:FLYTALLY_CURRENCY_V21_BROWSER -ErrorAction SilentlyContinue
  Push-Location $oldWorktree
  try {
    npm.cmd ci
    Assert-Exit "Frozen v20 npm ci"
    npm.cmd run build
    Assert-Exit "Frozen v20 optimized Next build"
    & node ".\node_modules\@playwright\test\cli.js" test --config=playwright.h4.config.mjs --workers=1 --retries=0 e2e/v380-h4-frozen-v20.spec.mjs e2e/trash-integrity.spec.mjs
    Assert-Exit "Frozen v20 authenticated browser read/write and protected-trash H4"
  } finally { Pop-Location }

  # Old runtime MUST NOT downgrade registry or reclassify legacy evidence.
  $post = (& $psql -X -w -v ON_ERROR_STOP=1 -qAt -d $env:DATABASE_URL -c $checkSql).Trim()
  Assert-Exit "H4 v21 posttest shape"
  if ($post -cne "1|12|4") { throw "Frozen v20 altered canonical v21 physical shape ($post)." }
  $legacy = (& $psql -X -w -v ON_ERROR_STOP=1 -qAt -d $env:DATABASE_URL -c "SELECT COUNT(*) FROM flights WHERE user_id=9001 AND price_currency_code IS NOT NULL").Trim()
  Assert-Exit "H4 legacy currency postcheck"
  if ($legacy -ne "0") { throw "Frozen v20 unexpectedly populated exact currency metadata." }
  $endCommit = (& git rev-parse HEAD).Trim()
  Assert-Exit "H4 candidate SHA readback"
  if ($endCommit -cne $commit) { throw "H4 candidate HEAD changed while the gate was running." }
  Write-Host "LOCAL H4 PASS: actual frozen $frozenV20Sha on disposable schema v21 (1 registry / 12 columns / 4 checks), authenticated old browser flows PASS. NOT PRODUCTION OR HISTORIC RESTORE." -ForegroundColor Green
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
  if ($worktreeAdded -and $oldWorktree) {
    & git worktree remove --force $oldWorktree
    if ($LASTEXITCODE -ne 0) {
      $mayDeleteTemporaryRoot = $false
      Write-Warning "Frozen v20 worktree removal failed; preserving $temporaryRoot for manual cleanup."
    }
  }
  if ($mayDeleteTemporaryRoot -and $temporaryRoot -and (Test-Path $temporaryRoot)) {
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
  }
  Pop-Location
}
