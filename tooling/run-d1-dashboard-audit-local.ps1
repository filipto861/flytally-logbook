# D1-A Dashboard screenshots on the OWNED disposable local PostgreSQL fixture.
# NEVER point this at an existing/remote database. Requires Windows, Node 24,
# installed dependencies/Chromium, and PostgreSQL 16/18 binaries.
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envNames = @("PATH","DATABASE_URL","PGPASSWORD","FLYTALLY_LOCAL_POSTGRES",
  "FLYTALLY_AUTH_BROWSER","FLYTALLY_CURRENCY_V21_BROWSER","FLYTALLY_D1_AUDIT_CAPTURE",
  "FLYTALLY_BROWSER_PASSWORD","SESSION_SECRET","SIGNING_SECRET","FLYTALLY_IDENTITY_SECRET",
  "FLYTALLY_BROWSER_EVIDENCE_FILE")
$saved = @{}
foreach ($key in $envNames) { $saved[$key] = [Environment]::GetEnvironmentVariable($key,"Process") }
$tempRoot = $null
$dataDir = $null
$pgCtl = $null
$pgRunning = $false
$owned = $false

function RequireExit([string]$name) {
  if ($LASTEXITCODE -ne 0) { throw "$name failed (exit $LASTEXITCODE)." }
}
function FreePort {
  $socket = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"),0)
  $socket.Start()
  try { return [int]$socket.LocalEndpoint.Port } finally { $socket.Stop() }
}
function RequirePortFree([int]$port) {
  $socket = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"),$port)
  try { $socket.Start() } catch { throw "Port $port is occupied; no database created." }
  finally { $socket.Stop() }
}
function PostgresBin {
  foreach ($major in @("18","16")) {
    $dir = Join-Path $env:ProgramFiles "PostgreSQL\$major\bin"
    if (@("initdb.exe","pg_ctl.exe","createdb.exe","psql.exe") |
        Where-Object { -not (Test-Path (Join-Path $dir $_)) }) { continue }
    return $dir
  }
  throw "PostgreSQL 16/18 executables not found; no database created."
}
Push-Location $root
try {
  if ($env:CI -or $env:VERCEL -or $env:VERCEL_ENV) {
    throw "Local-only audit: CI/Vercel environment refused."
  }
  $branch = (& git branch --show-current).Trim()
  RequireExit "Git branch"
  if ($branch -cne "test/logbook-d1-dashboard-visual-audit-20261024") {
    throw "Wrong branch '$branch'. Switch to the D1-A test branch."
  }
  $head = (& git rev-parse HEAD).Trim()
  RequireExit "Git HEAD"
  $modified = @(& git status --porcelain=v1 --untracked-files=no)
  RequireExit "Git worktree"
  $blocked = @($modified | Where-Object { $_ -cne " M next-env.d.ts" })
  if ($blocked.Count -gt 0) { throw "Tracked modifications present. Inspect git status; no audit started." }
  if (-not ((& node --version) -match '^v24\.')) {
    throw "Node.js 24.x required; no audit started."
  }
  if (-not (Test-Path (Join-Path $root "node_modules\@playwright\test\cli.js"))) {
    throw "Dependencies missing; run npm ci before this script."
  }
  RequirePortFree 3000
  $target = Join-Path $root "test-results\d1-dashboard-audit"
  if (Test-Path $target) {
    throw "Existing D1 audit evidence at $target. Back it up before rerunning."
  }
  $bin = PostgresBin
  $env:PATH = "$bin;$env:PATH"
  $env:PGPASSWORD = ""
  $pgCtl = Join-Path $bin "pg_ctl.exe"
  $port = FreePort
  if ($port -in @(5432,55432,55433,3000)) { throw "Reserved PostgreSQL port; no database created." }
  $tempRoot = Join-Path $env:TEMP ("flytally-d1-audit-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $tempRoot -ErrorAction Stop | Out-Null
  $dataDir = Join-Path $tempRoot "postgres-data"
  & (Join-Path $bin "initdb.exe") -D $dataDir -U flytally -A trust --encoding=UTF8 --no-instructions
  RequireExit "Create new physical PostgreSQL cluster"
  & $pgCtl -D $dataDir -l (Join-Path $tempRoot "pg.log") -o "-h 127.0.0.1 -p $port" -w -t 30 start
  RequireExit "Start private PostgreSQL"
  $pgRunning = $true
  & (Join-Path $bin "createdb.exe") -h 127.0.0.1 -p $port -U flytally flytally_currency_test
  RequireExit "Create NEW audit database"
  $env:DATABASE_URL = "postgresql://flytally@127.0.0.1:$port/flytally_currency_test"
  $env:FLYTALLY_LOCAL_POSTGRES = "1"
  $env:FLYTALLY_AUTH_BROWSER = "1"
  $env:FLYTALLY_CURRENCY_V21_BROWSER = "1"
  $env:FLYTALLY_D1_AUDIT_CAPTURE = "1"
  $env:FLYTALLY_BROWSER_PASSWORD = "D1-" + [guid]::NewGuid().ToString("N") + "!"
  $env:SESSION_SECRET = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
  $env:SIGNING_SECRET = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
  $env:FLYTALLY_IDENTITY_SECRET = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
  Remove-Item Env:FLYTALLY_BROWSER_EVIDENCE_FILE -ErrorAction SilentlyContinue
  $psql = Join-Path $bin "psql.exe"
  $identity = (& $psql -d $env:DATABASE_URL -X -w -v ON_ERROR_STOP=1 -Atqc "SELECT current_database()||'|'||current_user||'|'||host(inet_server_addr())||'|'||inet_server_port()").Trim()
  RequireExit "Read physical PostgreSQL identity"
  if ($identity -cne "flytally_currency_test|flytally|127.0.0.1|$port") {
    throw "Refusing bootstrap: database identity mismatch."
  }
  $observedDir = (& $psql -d $env:DATABASE_URL -X -w -v ON_ERROR_STOP=1 -Atqc "SHOW data_directory").Trim()
  RequireExit "Read physical data directory"
  $canonicalActual = ([IO.Path]::GetFullPath($observedDir) -replace '\\','/').TrimEnd('/')
  $canonicalOwned = ([IO.Path]::GetFullPath($dataDir) -replace '\\','/').TrimEnd('/')
  if ($canonicalActual -ine $canonicalOwned) { throw "Refusing bootstrap: physical cluster not owned by this run." }
  $count = (& $psql -d $env:DATABASE_URL -X -w -v ON_ERROR_STOP=1 -Atqc "SELECT count(*) FROM pg_tables WHERE schemaname='public'").Trim()
  RequireExit "Check EMPTY database"
  if ($count -cne "0") { throw "Refusing bootstrap: schema is not empty." }
  $owned = $true
  # Destructive bootstrap is permitted ONLY after physical ownership and empty schema proof.
  & node tooling/bootstrap-browser-smoke-db.mjs
  RequireExit "Bootstrap SYNTHETIC pilot fixture"
  & node tooling/apply-currency-v21-disposable.mjs
  RequireExit "Apply local-only v21 fixture schema"
  $schema = (& $psql -d $env:DATABASE_URL -X -w -v ON_ERROR_STOP=1 -Atqc "SELECT count(*) FROM flytally_schema_migrations").Trim()
  RequireExit "Verify v21 local schema"
  if ($schema -cne "21") { throw "Fixture schema registry mismatch; do not run browser." }
  Remove-Item Env:FLYTALLY_CURRENCY_V21_BROWSER -ErrorAction SilentlyContinue

  Write-Host "D1-A source HEAD: $head"
  Write-Host "Using NEW SYNTHETIC disposable DB only. No production DB access."
  & npm.cmd run build
  RequireExit "Next.js candidate build"
  & node ".\node_modules\@playwright\test\cli.js" test "e2e/d1-dashboard-visual-audit.spec.mjs" "--project=desktop-chromium" "--workers=1" "--retries=0"
  RequireExit "Dashboard 5-viewport / 2-theme screenshot audit"
  if (-not (Test-Path (Join-Path $target "dashboard-audit.json"))) {
    throw "Playwright did not create audit metrics."
  }
  $zip = Join-Path $root ("FlyTally-D1-Dashboard-Audit-" + $head.Substring(0,12) + ".zip")
  if (Test-Path $zip) { throw "Evidence ZIP already exists; refusing to overwrite." }
  Compress-Archive -LiteralPath $target -DestinationPath $zip -CompressionLevel Optimal
  Write-Host "D1-A CAPTURE COMPLETED: $zip" -ForegroundColor Green
  Write-Host "Includes 30 synthetic Dashboard screenshots and measured computed-style JSON."
  Write-Host "Screenshots are local evidence, not proof of native iPad Safari."
}
finally {
  if ($pgRunning -and $pgCtl -and $dataDir) {
    try {
      & $pgCtl -D $dataDir -m fast -w -t 25 stop
      if ($LASTEXITCODE -eq 0) { $pgRunning = $false }
      else { Write-Warning "Postgres stop failed; evidence cluster preserved at $tempRoot." }
    } catch { Write-Warning "Postgres stop failed; evidence cluster preserved at $tempRoot." }
  }
  if ($owned -and -not $pgRunning -and $tempRoot -and (Test-Path $tempRoot)) {
    $prefix = Join-Path $env:TEMP "flytally-d1-audit-"
    if ($tempRoot.StartsWith($prefix,[System.StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -LiteralPath $tempRoot -Force -Recurse
    }
  }
  foreach ($key in $envNames) {
    [Environment]::SetEnvironmentVariable($key,$saved[$key],"Process")
  }
  Pop-Location
}
