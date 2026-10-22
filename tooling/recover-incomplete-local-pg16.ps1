# FlyTally Logbook only. Recover an interrupted FIRST-TIME local PostgreSQL16
# bootstrap by archiving (NOT deleting) the verified-owned incomplete cluster.
# Default mode is READ-ONLY. Explicit -ArchiveIncompleteOwnedCluster is required.
[CmdletBinding()]
param([switch]$ArchiveIncompleteOwnedCluster)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$target = Join-Path $root ".flytally\persistent-local-pg16"
$data = Join-Path $target "data"
$marker = Join-Path $target "owner.json"
$envFile = Join-Path $root ".env.test.local"
$pidPath = Join-Path $data "postmaster.pid"
$versionPath = Join-Path $data "PG_VERSION"
$port = 55439
$expectedIp = "127.0.0.1"

function Require([bool]$ok, [string]$reason) {
  if (-not $ok) { throw "BLOCKED: $reason. No further action will be taken; inspect current process/cluster state." }
}
function Assert-NotReparse([string]$file) {
  $item = Get-Item -LiteralPath $file -Force
  Require (-not [bool]($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) "Reparse point is not an owned fixture path"
}
function Canonical([string]$value) {
  return ([IO.Path]::GetFullPath($value).Replace('/','\').TrimEnd('\'))
}

Push-Location $root
try {
  Require (Test-Path -LiteralPath $target -PathType Container) "Incomplete fixture directory missing"
  Require (-not (Test-Path -LiteralPath $marker)) "Completed owner marker already exists"
  Require (-not (Test-Path -LiteralPath $envFile)) "A local database configuration already exists"
  Require (Test-Path -LiteralPath $data -PathType Container) "Native PG16 data directory missing"
  Require (Test-Path -LiteralPath $versionPath -PathType Leaf) "Missing PG_VERSION"
  Require ((Get-Content -LiteralPath $versionPath -TotalCount 1).Trim() -ceq "16") "Not a PG16 data directory"
  Assert-NotReparse $target
  Assert-NotReparse $data
  Require (Test-Path -LiteralPath $pidPath -PathType Leaf) "No running-postmaster identity file"
  $lines = @(Get-Content -LiteralPath $pidPath -TotalCount 4)
  Require ($lines.Count -eq 4) "Postmaster identity is incomplete"
  $postmasterPid = 0
  $postmasterPort = 0
  Require ([int]::TryParse($lines[0].Trim(),[ref]$postmasterPid) -and $postmasterPid -gt 0) "Invalid postmaster PID"
  Require ([int]::TryParse($lines[3].Trim(),[ref]$postmasterPort) -and $postmasterPort -eq $port) "Postmaster uses an unexpected port"
  Require ((Canonical $lines[1]) -ieq (Canonical $data)) "Postmaster has another data directory"
  $process = Get-Process -Id $postmasterPid -ErrorAction SilentlyContinue
  Require ($null -ne $process -and $process.ProcessName -ieq "postgres") "Expected PostgreSQL owner process is missing"
  $listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
  Require ($listeners.Count -eq 1) "Missing or multiple local test port listeners"
  Require ($listeners[0].LocalAddress -eq $expectedIp) "PostgreSQL is not exclusively bound to loopback"
  Require ($listeners[0].OwningProcess -eq $postmasterPid) "Listener belongs to a different process"

  $pgBin = Join-Path $env:ProgramFiles "PostgreSQL\16\bin"
  $pgCtl = Join-Path $pgBin "pg_ctl.exe"
  Require (Test-Path -LiteralPath $pgCtl -PathType Leaf) "The PostgreSQL16 pg_ctl.exe is missing"
  $v = & $pgCtl --version
  Require ($LASTEXITCODE -eq 0 -and $v -match "PostgreSQL 16\.") "The pg_ctl version is not PG16"

  Write-Host "Verified isolated FlyTally native PG16 bootstrap:"
  Write-Host "  PID: $postmasterPid"
  Write-Host "  Port: $($expectedIp):$port"
  Write-Host "  Cluster path: $data"
  Write-Host "  Bootstrap: INCOMPLETE (.env.test.local and owner.json both absent)"
  if (-not $ArchiveIncompleteOwnedCluster) {
    Write-Host "READ-ONLY audit complete. No processes stopped and no files changed."
    Write-Host "To archive this verified-only cluster, rerun with -ArchiveIncompleteOwnedCluster."
    return
  }

  # Disruption is limited to the exact PostgreSQL process/data dir verified above.
  # Keep all files in an archival sibling; never recursively delete user data.
  Write-Host "Stopping ONLY the verified FlyTally PG16 cluster (fast shutdown)..."
  & $pgCtl -D $data -m fast -w -t 30 stop
  Require ($LASTEXITCODE -eq 0) "Owned cluster shutdown failed"
  Require ($null -eq (Get-Process -Id $postmasterPid -ErrorAction SilentlyContinue)) "Owner PID is still running"
  $remaining = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
  Require ($remaining.Count -eq 0) "Port is still owned by a running process"

  $parent = Split-Path -Parent $target
  $archive = Join-Path $parent ("persistent-local-pg16-interrupted-" + (Get-Date -Format "yyyyMMdd-HHmmss") + "-" + [guid]::NewGuid().ToString("N").Substring(0,8))
  Require (-not (Test-Path -LiteralPath $archive)) "Archive destination already exists"
  Move-Item -LiteralPath $target -Destination $archive -ErrorAction Stop
  Write-Host "ARCHIVED (not deleted): $archive"
  Write-Host "Only the verified incomplete FlyTally cluster was stopped and archived."
  Write-Host "You can now run npm run setup:local on the updated branch."
} finally {
  Pop-Location
}
