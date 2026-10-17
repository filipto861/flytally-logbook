# GPS R2.1b I2-B1: STRICTLY READ-ONLY host inventory.
# Windows PowerShell 5.1 compatible, ASCII text.
# Does NOT connect to PostgreSQL, start/stop services, create/delete files,
# inspect process arguments, or declare that any ACL or cluster is trusted.
param([switch]$InventoryOnly)
$ErrorActionPreference = 'Stop'

function Probe-Path([string]$Location) {
    if (-not (Test-Path -LiteralPath $Location -PathType Container)) {
        return @{ exists=$false; reparsePoint=$null; aclReadable=$false; aclTrusted=$false }
    }
    $item = Get-Item -LiteralPath $Location -Force -ErrorAction Stop
    $acl = Get-Acl -LiteralPath $Location -ErrorAction Stop
    if ($null -eq $acl) { throw 'ACL unavailable' }
    $isReparse = (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)
    return @{ exists=$true; reparsePoint=[bool]$isReparse; aclReadable=$true; aclTrusted=$false }
}

try {
    if (-not $InventoryOnly) { throw 'explicit read-only flag required' }
    if ($PSVersionTable.PSVersion.Major -lt 5) { throw 'PowerShell version unsupported' }
    foreach ($entry in (Get-ChildItem Env:)) {
        $key = $entry.Name.ToUpperInvariant()
        if ($entry.Value -and ($key -match '^PG[A-Z0-9_]*$' -or
            @('DATABASE_URL','DIRECT_URL','NEON_DATABASE_URL','DOCKER_HOST','DOCKER_CONTEXT') -contains $key)) {
            throw 'ambient database override'
        }
    }
    $principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
    $adminRole = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    $profile = [Environment]::GetFolderPath('UserProfile')
    $appdata = Join-Path $profile 'AppData'
    $local = [Environment]::GetFolderPath('LocalApplicationData')
    if (-not $profile -or -not $local) { throw 'user directories unavailable' }

    $bin = 'C:\Program Files\PostgreSQL\16\bin'
    $versions = @{}
    foreach ($name in @('initdb','pg_ctl','psql','postgres','pg_controldata')) {
        $exe = Join-Path $bin ($name + '.exe')
        if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { throw 'PG16 binary missing' }
        $output = & $exe --version
        if ($LASTEXITCODE -ne 0 -or $null -eq $output) { throw 'version probe failed' }
        $versions[$name] = ([string]$output).Trim()
    }
    $services = @{}
    foreach ($name in @('postgresql-x64-16','postgresql-x64-18')) {
        $service = Get-Service -Name $name -ErrorAction SilentlyContinue
        $services[$name] = if ($null -eq $service) { 'Absent' }
            elseif ($service.Status -eq 'Running') { 'Running' }
            else { 'Stopped' }
    }
    $observations = @{
        userProfile = Probe-Path $profile
        appData = Probe-Path $appdata
        localAppData = Probe-Path $local
        candidateRoot = Probe-Path (Join-Path $local 'FlyTallySyntheticPG16')
    }
    $result = @{
        format = 'flytally-i2b1-windows-inventory-v1'
        platform = 'win32'
        readOnly = $true
        runtimeAuthorization = $false
        permitsClusterMutation = $false
        effectiveToken = @{
            adminRoleObserved = [bool]$adminRole
            source = 'WindowsPrincipal.IsInRole'
            identityAttested = $false
        }
        binVersions = $versions
        serviceStatus = $services
        pathObservations = $observations
    }
    $result | ConvertTo-Json -Depth 8 -Compress
} catch {
    [Console]::Error.WriteLine('I2-B1 inventory unavailable; no runtime operation performed.')
    exit 1
}
