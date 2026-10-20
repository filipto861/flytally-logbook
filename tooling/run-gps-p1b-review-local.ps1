# FlyTally GPS P1B owner-only authenticated visual review.
# OWNED, NEW, DISPOSABLE PG16 cluster, NOT the existing 55432 service/Neon.
# Script creates one unique cluster, validates identity, bootstraps canonical
# browser fixture, applies exact approved v20/v21 SQL, then runs loopback Next.
# Existing DBs never receive migrations. Stop with Ctrl+C for cleanup.
$ErrorActionPreference="Stop"
Set-StrictMode -Version Latest
$repo=(Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$expectedBranch="feat/gps-v2-r3-p1b-inconclusive-review-ui-20261019"
$names=@("DATABASE_URL","FLYTALLY_LOCAL_POSTGRES","FLYTALLY_AUTH_BROWSER","FLYTALLY_CURRENCY_V21_BROWSER","FLYTALLY_BROWSER_PASSWORD","SESSION_SECRET","SIGNING_SECRET","PGPASSWORD","NEXT_PUBLIC_FLYTALLY_GPS_R3_QUALITY_REVIEW","NEXT_PUBLIC_FLYTALLY_GPS_V2_ADVISORY")
$saved=@{}
foreach($name in $names){$saved[$name]=[Environment]::GetEnvironmentVariable($name,"Process")}
$oldPath=$env:Path
$pgBin=Join-Path $env:ProgramFiles "PostgreSQL\16\bin"
$pgctl=Join-Path $pgBin "pg_ctl.exe"
$root=$null;$dataDir=$null;$started=$false;$startupAttempted=$false;$cleanupAllowed=$false
function Assert-Exit([string]$label){if($LASTEXITCODE -ne 0){throw "$label failed (exit $LASTEXITCODE)."}}
function Assert-File([string]$path){if(-not (Test-Path -LiteralPath $path -PathType Leaf)){throw "Missing required local tool or repository script."}}
Write-Host "FlyTally GPS R3-P1B - isolated disposable local browser" -ForegroundColor Cyan
Push-Location $repo
try{
  if($env:CI -or (Test-Path Env:VERCEL) -or (Test-Path Env:VERCEL_ENV)){throw "CI/hosted environment refused."}
  if(-not ((& node --version) -match '^v24\.')){throw "Node 24.x required."}
  $branch=(& git branch --show-current).Trim()
  Assert-Exit "Git branch read"
  if($branch -cne $expectedBranch){throw "Wrong Git branch; switch to P1B first."}
  $dirty=@(& git status --porcelain)
  Assert-Exit "Git status"
  if($dirty.Count -gt 0){throw "Worktree is dirty; do not discard changes."}
  $head=(& git rev-parse HEAD).Trim()
  Assert-Exit "Git HEAD"
  $remote=(& git rev-parse "refs/remotes/origin/$expectedBranch").Trim()
  Assert-Exit "Origin branch"
  if($head -cne $remote){throw "HEAD differs from fetched origin; pull before running."}
  Write-Host "Exact candidate: $($head.Substring(0,8))"
  $nextCli=Join-Path $repo "node_modules\next\dist\bin\next"
  Assert-File $nextCli
  $initdb=Join-Path $pgBin "initdb.exe"
  $createdb=Join-Path $pgBin "createdb.exe"
  $psql=Join-Path $pgBin "psql.exe"
  foreach($file in @($initdb,$pgctl,$createdb,$psql)){Assert-File $file}
  $bootstrap=Join-Path $repo "tooling\bootstrap-browser-smoke-db.mjs"
  $migrate=Join-Path $repo "tooling\apply-currency-v21-disposable.mjs"
  Assert-File $bootstrap
  Assert-File $migrate
  # Refuse running Next instance; do not accidentally reuse a stale server.
  $listener=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"),3000)
  try{$listener.Start()}catch{throw "Port 3000 occupied; stop existing npm run dev."}finally{$listener.Stop()}
  $env:Path="$pgBin;$oldPath"
  $socket=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"),0)
  $socket.Start()
  try{$port=$socket.LocalEndpoint.Port}finally{$socket.Stop()}
  if($port -in @(5432,55432)){throw "Reserved PostgreSQL port; refused."}
  $root=Join-Path $env:TEMP ("flytally-p1b-owned-"+[guid]::NewGuid().ToString("N"))
  [void](New-Item -ItemType Directory -Path $root -ErrorAction Stop)
  $dataDir=Join-Path $root "postgres-data"
  $logPath=Join-Path $root "postgres.log"
  Write-Host "Creating OWNED PG16 cluster at 127.0.0.1:$port"
  & $initdb -D $dataDir -U flytally -A trust --encoding=UTF8 --no-instructions
  Assert-Exit "Owned initdb"
  $startupAttempted=$true
  & $pgctl -D $dataDir -l $logPath -o "-h 127.0.0.1 -p $port" -w -t 30 start
  Assert-Exit "Owned cluster startup"
  $started=$true
  & $createdb -h 127.0.0.1 -p $port -U flytally flytally_currency_test
  Assert-Exit "Owned DB creation"
  $env:PGPASSWORD=""
  $env:DATABASE_URL="postgresql://flytally@127.0.0.1:$port/flytally_currency_test"
  $identity=@(& $psql -d $env:DATABASE_URL -X -w -At -F "|" -v "ON_ERROR_STOP=1" -c "SELECT current_database(),current_user,host(inet_server_addr()),inet_server_port()")
  Assert-Exit "DB identity"
  $expected="flytally_currency_test|flytally|127.0.0.1|$port"
  if($identity.Count -ne 1 -or ([string]$identity[0]).Trim() -cne $expected){throw "DB identity mismatch; no schema bootstrap."}
  $dataIdentity=@(& $psql -d $env:DATABASE_URL -X -w -At -v "ON_ERROR_STOP=1" -c "SHOW data_directory")
  Assert-Exit "Data directory identity"
  if($dataIdentity.Count -ne 1 -or [IO.Path]::GetFullPath(([string]$dataIdentity[0]).Trim()).TrimEnd('\') -ine [IO.Path]::GetFullPath($dataDir).TrimEnd('\')){throw "Cluster data directory mismatch; no schema bootstrap."}
  Write-Host "Verified new cluster, database, user, port and data directory."
  $env:FLYTALLY_LOCAL_POSTGRES="1"
  $env:FLYTALLY_AUTH_BROWSER="1"
  $env:FLYTALLY_CURRENCY_V21_BROWSER="1"
  $env:FLYTALLY_BROWSER_PASSWORD="FlyTally-Browser-2026!"
  $env:SESSION_SECRET=([guid]::NewGuid().ToString("N")+[guid]::NewGuid().ToString("N"))
  $env:SIGNING_SECRET=([guid]::NewGuid().ToString("N")+[guid]::NewGuid().ToString("N"))
  $env:NEXT_PUBLIC_FLYTALLY_GPS_R3_QUALITY_REVIEW="1"
  $env:NEXT_PUBLIC_FLYTALLY_GPS_V2_ADVISORY="0"
  # Existing bootstrap DROPS public; here it targets ONLY owned new cluster.
  & node $bootstrap
  Assert-Exit "New disposable browser bootstrap"
  # Canonical 20/21 DDL and physical evidence, no fabricated registry version.
  & node $migrate
  Assert-Exit "New disposable canonical v20/v21 migration"
  Write-Host "Disposable v21 READY; existing port 55432 untouched." -ForegroundColor Green
  Write-Host "Open http://127.0.0.1:3000/login and sign in as browser-auth@example.test"
  Write-Host "Use the repository's documented browser fixture password."
  Write-Host "Review sample07 but DO NOT SAVE a real flight."
  Write-Host "When finished, press Ctrl+C here to remove the test cluster."
  # Next listener is LOOPBACK only; no LAN/VPN address is exposed.
  & node $nextCli dev --hostname 127.0.0.1 --port 3000
  Assert-Exit "Local Next review"
}finally{
  $env:Path="$pgBin;$oldPath"
  if($started){
    & $pgctl -D $dataDir -m fast -w -t 30 stop
    if($LASTEXITCODE -eq 0){$cleanupAllowed=$true}
    else{Write-Warning "Stop failed; preserve OWNED cluster at $root."}
  }elseif($root){
    if($startupAttempted -and (Test-Path (Join-Path $dataDir "postmaster.pid"))){
      Write-Warning "Startup uncertain; preserve OWNED cluster at $root."
    }else{$cleanupAllowed=$true}
  }
  if($cleanupAllowed -and $root -and (Test-Path -LiteralPath $root)){
    Remove-Item -LiteralPath $root -Recurse -Force
    Write-Host "Owned test cluster cleaned up."
  }
  foreach($name in $names){
    [Environment]::SetEnvironmentVariable($name,$saved[$name],"Process")
  }
  $env:Path=$oldPath
  Pop-Location
}
