# PR340: isolated PostgreSQL16 partition execution. NEVER production/Neon.
# Each partition gets a new owned PG16 cluster. No release ledger writes.
# The real-v20 catalog remains BLOCKED until a reviewed canonical public seed exists.
param([ValidateSet("shared-core","shared-restore","v21-migration","d3b-migration-chain","d3b-races","all-supported")][string]$Partition="all-supported",[switch]$WorkMemDiagnostic)
$ErrorActionPreference="Stop"
Set-StrictMode -Version Latest
$root=(Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$branch="fix/3.8.0-flights-exact-cost-summary"
$oldPath=$env:Path
$vars=@("DATABASE_URL","PGPASSWORD","PGHOST","PGPORT","PGUSER","PGDATABASE","PGSERVICE","PGSERVICEFILE","PGPASSFILE","PGOPTIONS","PGSSLMODE","PGCONNECT_TIMEOUT","FLYTALLY_POSTGRES_INTEGRATION","FLYTALLY_D2_FULL_V20_DISPOSABLE","FLYTALLY_V21_RELEASE_DISPOSABLE","FLYTALLY_D3B_MIGRATIONS_PG16_DISPOSABLE","FLYTALLY_D3B_TARGETED_PG16_DISPOSABLE","FLYTALLY_D3B_FULL_V20_DISPOSABLE")
$saved=@{}
# Capture every inherited PG* route/credential knob, not a hand-picked subset.
$vars=@($vars + @([Environment]::GetEnvironmentVariables("Process").Keys | Where-Object { [string]$_ -match "^PG[A-Z0-9_]+$" }) | Select-Object -Unique)
foreach($name in $vars){$saved[$name]=[Environment]::GetEnvironmentVariable($name,"Process")}
$clusters=@()
function Ensure-Exit([string]$step) {if($LASTEXITCODE -ne 0){throw "$step failed ($LASTEXITCODE)"}}
Push-Location $root
try {
  if($env:VERCEL -or $env:VERCEL_ENV -or $env:CI){throw "Production/CI markers present. Refusing local partition execution."}
  if(-not ((& node --version) -match '^v24\.')){throw "Node24 required"}
  $dirty=@(& git status --porcelain)
  Ensure-Exit "git status"
  if($dirty.Count -gt 0){throw "Working tree must be entirely clean"}
  $sha=(& git rev-parse HEAD).Trim(); Ensure-Exit "git HEAD"
  $origin=(& git rev-parse "refs/remotes/origin/$branch").Trim();Ensure-Exit "remote PR"
  if($sha -cne $origin){throw "HEAD must match fetched PR branch exactly"}
  & node tooling/validate-postgres-partition-registry.mjs
  Ensure-Exit "registry"
  $registry=Get-Content (Join-Path $root "tooling/postgres-partition-registry.json") -Raw | ConvertFrom-Json
  if($WorkMemDiagnostic -and $Partition -ne "shared-core"){throw "work_mem diagnostic is only allowed for shared-core"}
  $selected=@($registry.partitions | Where-Object { $Partition -eq "all-supported" -or $_.id -eq $Partition })
  if($selected.Count -lt 1){throw "No matching partition"}
  $pgBin=Join-Path $env:ProgramFiles "PostgreSQL\16\bin"
  foreach($prog in @("initdb.exe","pg_ctl.exe","createdb.exe","psql.exe")){if(-not(Test-Path (Join-Path $pgBin $prog))){throw "PostgreSQL16 binary missing: $prog"}}
  $env:Path="$pgBin;$oldPath"
  foreach($part in $selected){
    if($part.id -eq "real-v20-catalog"){throw "BLOCKED: source-backed public pre-v1 foundation and actual v1-v20 migration setup not verified. No release PASS."}
    # Remove all inherited PostgreSQL routing and prior partition flags.
    foreach($name in $vars){[Environment]::SetEnvironmentVariable($name,$null,"Process")}
    $temp=Join-Path $env:TEMP ("flytally-pr340-part-"+[guid]::NewGuid().ToString("N"))
    [void](New-Item -ItemType Directory -Path $temp)
    $data=Join-Path $temp "pgdata";$log=Join-Path $temp "postgres.log"
    $owned=[pscustomobject]@{Directory=$temp;Data=$data;Started=$false;StopSuccess=$false}
    $clusters+=,$owned
    $sock=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"),0)
    $sock.Start()
    try{$port=$sock.LocalEndpoint.Port}finally{$sock.Stop()}
    if($port -in @(5432,55432)){throw "Reserved port"}
    & (Join-Path $pgBin "initdb.exe") -D $data -U flytally -A trust --encoding=UTF8 --no-instructions
    Ensure-Exit "initdb $($part.id)"
    & (Join-Path $pgBin "pg_ctl.exe") -D $data -l $log -o "-h 127.0.0.1 -p $port" -w -t 30 start
    Ensure-Exit "pg_ctl start $($part.id)"
    $owned.Started=$true
    & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p $port -U flytally flytally_currency_test
    Ensure-Exit "createdb"
    $url="postgresql://flytally@127.0.0.1:$port/flytally_currency_test"
    $identity=@(& (Join-Path $pgBin "psql.exe") -X -w -A -t -v ON_ERROR_STOP=1 -d $url -c "SELECT current_database()||'|'||current_user||'|'||host(inet_server_addr())||'|'||inet_server_port()||'|'||current_setting('server_version_num')")
    Ensure-Exit "physical identity"
    $observed=(@($identity | Where-Object {$_ -ne ""}) -join "").Trim()
    if($observed -cne "flytally_currency_test|flytally|127.0.0.1|$port|160009" -and $observed -notmatch "^flytally_currency_test\|flytally\|127\.0\.0\.1\|$port\|16[0-9]{4}$"){throw "PG16 identity mismatch: $observed"}
    $env:DATABASE_URL=$url
    $env:PGCONNECT_TIMEOUT="5"
    if($WorkMemDiagnostic){
      # This owned fresh PG16 cluster is the only target. Never change a shared DB.
      & (Join-Path $pgBin "psql.exe") -X -w -v ON_ERROR_STOP=1 -d $url -c "ALTER SYSTEM SET work_mem = '64MB'"
      Ensure-Exit "work_mem set"
      & (Join-Path $pgBin "psql.exe") -X -w -v ON_ERROR_STOP=1 -d $url -c "SELECT pg_reload_conf()"
      Ensure-Exit "work_mem reload"
      $wm=(& (Join-Path $pgBin "psql.exe") -X -w -A -t -v ON_ERROR_STOP=1 -d $url -c "SHOW work_mem").Trim()
      Ensure-Exit "work_mem verify"
      if($wm -ne "64MB"){throw "Unexpected diagnostic work_mem: $wm"}
      Write-Host "DIAGNOSTIC-ONLY work_mem=64MB (not baseline/release evidence)" -ForegroundColor Yellow
    }
    foreach($flag in $part.purposeFlags){[Environment]::SetEnvironmentVariable([string]$flag,"1","Process")}
    Write-Host "Running $($part.id): $($part.expectedTests) cases on owned localhost PG16 $port"
    & node tooling/run-pr340-partition-tests.mjs $part.id $temp
    Ensure-Exit "strict TAP partition $($part.id)"
    if($WorkMemDiagnostic){Write-Host "DIAGNOSTIC-ONLY completed (NOT release evidence): $temp" -ForegroundColor Yellow}
    else{Write-Host "Validated partition $($part.id) (NOT a release PASS), evidence: $temp" -ForegroundColor Green}
    & (Join-Path $pgBin "pg_ctl.exe") -D $data -m fast -w -t 30 stop
    Ensure-Exit "owned cluster stop"
    $owned.Started=$false;$owned.StopSuccess=$true
  }
  if($Partition -eq "all-supported"){throw "Five partitions executed; real-v20-catalog NOT RUN. 163/163 release gate BLOCKED; evidence must be reviewed."}
  Write-Host "Individual partition executed; not a canonical release PASS." -ForegroundColor Yellow
}finally{
  foreach($cluster in $clusters){
    if($cluster.Started){
      try{& (Join-Path $pgBin "pg_ctl.exe") -D $cluster.Data -m fast -w -t 30 stop
        if($LASTEXITCODE -eq 0){$cluster.StopSuccess=$true;$cluster.Started=$false}
      }catch{}
    }
    if($cluster.StopSuccess){
      # Preserve TAP and cluster logs for evidence even after clean shutdown.
      Write-Host "Stopped own cluster; evidence directory retained: $($cluster.Directory)"
    }else{Write-Warning "Preserved potentially running/failed cluster: $($cluster.Directory)"}
  }
  foreach($name in $vars){[Environment]::SetEnvironmentVariable($name,$saved[$name],"Process")}
  $env:Path=$oldPath
  Pop-Location
}
