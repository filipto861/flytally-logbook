# FlyTally Logbook N1 - visual preview with a private, throwaway local PostgreSQL cluster.
# No Playwright, test suite, release gate, deploy or production database action.
# Requires: Windows PowerShell, Node 24, Git, PostgreSQL 16/18 binaries and npm dependencies.
# This script creates and owns its PostgreSQL cluster under a NEW unique TEMP directory.
# IMPORTANT: tooling/bootstrap-browser-smoke-db.mjs DROPS the public schema.
# NEVER run that bootstrap independently against an existing database.
param([int]$WebPort = 3000)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$expectedBranch = "feat/logbook-n1a-modern-navigation-20261023"
$envNames = @(
  "PATH", "DATABASE_URL", "FLYTALLY_LOCAL_POSTGRES",
  "FLYTALLY_AUTH_BROWSER", "FLYTALLY_CURRENCY_V21_BROWSER",
  "FLYTALLY_BROWSER_PASSWORD", "SESSION_SECRET", "SIGNING_SECRET",
  "FLYTALLY_IDENTITY_SECRET", "PGPASSWORD"
)
$savedEnv = @{}
foreach ($name in $envNames) {
  $savedEnv[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}
$temporaryRoot = $null
$dataDir = $null
$pgCtl = $null
$pgRunning = $false
$ownedServer = $false
$pgPort = $null

function Assert-Exit([string]$step) {
  if ($LASTEXITCODE -ne 0) { throw "$step failed (exit code $LASTEXITCODE)." }
}

function Assert-PortFree([int]$port) {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $port)
  try { $listener.Start() }
  catch { throw "Port $port is occupied on 127.0.0.1; stop the existing service or choose another WebPort." }
  finally { $listener.Stop() }
}

function Select-FreePgPort {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), 0)
  $listener.Start()
  try { return [int]$listener.LocalEndpoint.Port }
  finally { $listener.Stop() }
}

function Find-PostgresBin {
  $candidateDirs = @(
    (Join-Path $env:ProgramFiles "PostgreSQL\18\bin"),
    (Join-Path $env:ProgramFiles "PostgreSQL\16\bin")
  )
  foreach ($dir in $candidateDirs) {
    if (@("initdb.exe","pg_ctl.exe","createdb.exe","psql.exe") |
        Where-Object { -not (Test-Path (Join-Path $dir $_)) }) { continue }
    return $dir
  }
  throw "PostgreSQL 16 or 18 binaries not found in Program Files. Nothing started or modified."
}

Push-Location $repoRoot
try {
  if ((& git branch --show-current).Trim() -ne $expectedBranch) {
    throw "Wrong Git branch; switch to $expectedBranch first. No database created."
  }
  Assert-Exit "Git branch inspection"
  if (@(& git status --porcelain --untracked-files=no).Count -gt 0) {
    throw "Tracked worktree is not clean. Commit or switch to a clean checkout before preview."
  }
  if (-not ((& node --version) -match '^v24\.')) {
    throw "Node 24.x required. Nothing started."
  }
  if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw "npm.cmd not found."
  }
  if (-not (Test-Path (Join-Path $repoRoot "node_modules"))) {
    throw "Dependencies not installed. Run npm.cmd ci once before this preview."
  }
  if ((Test-Path Env:VERCEL) -or (Test-Path Env:VERCEL_ENV) -or (Test-Path Env:CI)) {
    throw "Hosting/CI environment marker present. This script is local-only."
  }
  if ($WebPort -lt 1024 -or $WebPort -gt 65535) {
    throw "Invalid preview HTTP port."
  }
  Assert-PortFree $WebPort
  $pgBin = Find-PostgresBin
  $pgCtl = Join-Path $pgBin "pg_ctl.exe"
  $env:PATH = "$pgBin;$env:PATH"
  $env:PGPASSWORD = ""

  # A new GUID-qualified cluster, NEVER an already-used local PostgreSQL service.
  $temporaryRoot = Join-Path $env:TEMP ("flytally-n1-preview-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $temporaryRoot -ErrorAction Stop | Out-Null
  $dataDir = Join-Path $temporaryRoot "postgres-data"
  $pgLog = Join-Path $temporaryRoot "postgres.log"
  $pgPort = Select-FreePgPort
  if ($pgPort -in @(5432,55432,55433)) { throw "Disallowed PostgreSQL port." }

  Write-Host "N1-A preview candidate: $((& git rev-parse HEAD).Trim())"
  Write-Host "Disposable cluster directory: $temporaryRoot"
  $initDb = Join-Path $pgBin "initdb.exe"
  $createdb = Join-Path $pgBin "createdb.exe"
  $psql = Join-Path $pgBin "psql.exe"

  # Trust authentication is ONLY for this ephemeral server bound to 127.0.0.1.
  & $initDb -D $dataDir -U flytally -A trust --encoding=UTF8 --no-instructions
  Assert-Exit "Temporary initdb"
  & $pgCtl -D $dataDir -l $pgLog -o "-h 127.0.0.1 -p $pgPort" -w -t 30 start
  Assert-Exit "Temporary PostgreSQL startup"
  $pgRunning = $true

  & $createdb -h 127.0.0.1 -p $pgPort -U flytally flytally_currency_test
  Assert-Exit "Create dedicated preview database"
  $env:DATABASE_URL = "postgresql://flytally@127.0.0.1:$pgPort/flytally_currency_test"
  $env:FLYTALLY_LOCAL_POSTGRES = "1"
  $env:FLYTALLY_AUTH_BROWSER = "1"
  $env:FLYTALLY_CURRENCY_V21_BROWSER = "1"
  $env:FLYTALLY_BROWSER_PASSWORD = "Preview-" + [guid]::NewGuid().ToString("N") + "!"
  $env:SESSION_SECRET = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
  $env:SIGNING_SECRET = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
  $env:FLYTALLY_IDENTITY_SECRET = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")

  # PHYSICAL identity proof before invoking any destructive fixture initialization.
  $identity = (& $psql -d $env:DATABASE_URL -X -w -v ON_ERROR_STOP=1 -Atqc "SELECT current_database()||'|'||current_user||'|'||host(inet_server_addr())||'|'||inet_server_port()").Trim()
  Assert-Exit "Local database identity probe"
  $expectedIdentity = "flytally_currency_test|flytally|127.0.0.1|$pgPort"
  if ($identity -cne $expectedIdentity) { throw "Database identity mismatch; REFUSING fixture writes." }
  $actualDataDir = (& $psql -d $env:DATABASE_URL -X -w -v ON_ERROR_STOP=1 -Atqc "SHOW data_directory").Trim()
  Assert-Exit "Local physical PostgreSQL cluster probe"
  $actualDir = ([IO.Path]::GetFullPath($actualDataDir) -replace '\\','/').TrimEnd('/')
  $ownedDir = ([IO.Path]::GetFullPath($dataDir) -replace '\\','/').TrimEnd('/')
  if ($actualDir -ine $ownedDir) {
    throw "Physical PostgreSQL data-directory mismatch; REFUSING fixture writes."
  }
  $tableCount = (& $psql -d $env:DATABASE_URL -X -w -v ON_ERROR_STOP=1 -Atqc "SELECT count(*) FROM pg_tables WHERE schemaname='public'").Trim()
  Assert-Exit "Fresh disposable schema probe"
  if ($tableCount -ne "0") { throw "Preview database is not empty; REFUSING fixture bootstrap." }
  $ownedServer = $true

  # The bootstrap DROPS public and seeds synthetic pilot accounts/records.
  # Running it is safe ONLY AFTER the new-cluster and empty-schema checks above.
  & node tooling/bootstrap-browser-smoke-db.mjs
  Assert-Exit "Synthetic local fixture bootstrap"
  & node tooling/apply-currency-v21-disposable.mjs
  Assert-Exit "Disposable canonical v20/v21 schema application"
  $schemaEvidence = (& $psql -d $env:DATABASE_URL -X -w -v ON_ERROR_STOP=1 -Atqc "SELECT count(*) FROM flytally_schema_migrations").Trim()
  Assert-Exit "Schema registry readback"
  if ($schemaEvidence -ne "21") { throw "Local schema v21 not fully registered. Preview blocked." }

  # Purpose flags were needed exclusively to apply schema-first fixture SQL.
  # Normal interactive preview uses the local DB adapter, not the browser reset runner.
  Remove-Item Env:FLYTALLY_AUTH_BROWSER -ErrorAction SilentlyContinue
  Remove-Item Env:FLYTALLY_CURRENCY_V21_BROWSER -ErrorAction SilentlyContinue

  Write-Host ""
  Write-Host "N1-A VISUAL PREVIEW - localhost only" -ForegroundColor Green
  Write-Host ("URL: http://127.0.0.1:{0}/login" -f $WebPort)
  Write-Host "Login: browser-auth@example.test"
  Write-Host "Password (ephemeral, do not share): $env:FLYTALLY_BROWSER_PASSWORD"
  Write-Host "Preview data is synthetic and will be removed with its temporary cluster."
  Write-Host "Stop with Ctrl+C. No release tests are being executed."
  Write-Host ""
  & npm.cmd run dev -- --hostname 127.0.0.1 --port $WebPort
  Assert-Exit "Next.js preview server"
}
finally {
  if ($pgRunning -and $pgCtl -and $dataDir) {
    try {
      & $pgCtl -D $dataDir -m fast -w -t 25 stop
      if ($LASTEXITCODE -ne 0) {
        Write-Warning "Temporary PostgreSQL did not stop cleanly. Data was NOT deleted: $temporaryRoot"
        $pgRunning = $true
      } else { $pgRunning = $false }
    } catch {
      Write-Warning "Could not stop temporary PostgreSQL; inspect manually: $temporaryRoot"
    }
  }
  if ($temporaryRoot -and $ownedServer -and -not $pgRunning -and (Test-Path $temporaryRoot)) {
    # Only delete the GUID-qualified folder created by THIS invocation.
    $expectedPrefix = Join-Path $env:TEMP "flytally-n1-preview-"
    if ($temporaryRoot.StartsWith($expectedPrefix,[System.StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -LiteralPath $temporaryRoot -Force -Recurse -ErrorAction SilentlyContinue
    }
  }
  foreach ($name in $envNames) {
    [Environment]::SetEnvironmentVariable($name, $savedEnv[$name], "Process")
  }
  Pop-Location
}
