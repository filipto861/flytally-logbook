# DATA-1D PowerShell on actual Windows: locally mocked node.cmd, zero Neon access.
# Runs ONLY with a fabricated, invalid URI never taken from repository secrets.
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'data1-neon-http-store-local.ps1'
$global:data1FakeUri = 'postgresql://synthetic_data1_owner:FAKE_NOT_REAL@ep-fake.eu-central-1.aws.neon.tech/synthetic_data1'
$project = 'clean-fixture-12345678'
$branch = 'br-mock-123'
$token = 'aaaaaaaaaaaaaaaaaaaa'
$originalPath = $env:PATH
$originalCI = $env:CI
$mockDirectory = Join-Path $env:RUNNER_TEMP ('data1-win-mock-' + [Guid]::NewGuid().ToString('N'))
$mockNode = Join-Path $mockDirectory 'node.cmd'
$global:readHostCalls = 0

function Assert-Cleared {
    foreach ($key in @(
        'DATABASE_URL', 'DATA1_SYNTHETIC_ONLY', 'DATA1_EXPECTED_PROJECT_ID',
        'DATA1_EXPECTED_BRANCH_ID', 'DATA1_EXPECTED_DATABASE', 'DATA1_EXPECTED_ROLE',
        'DATA1_ALLOW_TEST_WRITES'
    )) {
        if ([Environment]::GetEnvironmentVariable($key, 'Process')) {
            throw ('Sensitive process variable not cleared: ' + $key)
        }
    }
}

function global:Read-Host {
    param([string]$Prompt, [switch]$AsSecureString)
    $global:readHostCalls++
    if ($AsSecureString) {
        return ConvertTo-SecureString -String $global:data1FakeUri -AsPlainText -Force
    }
    if ($Prompt -like 'Type EXECUTE*') {
        return 'EXECUTE'
    }
    throw 'Unexpected mock Read-Host prompt'
}

try {
    New-Item -ItemType Directory -Path $mockDirectory -ErrorAction Stop | Out-Null
    $cmd = @'
@echo off
if "%~1"=="--version" (
  echo v24.22.1
  exit /b 0
)
if not "%DATABASE_URL%"=="postgresql://synthetic_data1_owner:FAKE_NOT_REAL@ep-fake.eu-central-1.aws.neon.tech/synthetic_data1" exit /b 21
if not "%DATA1_SYNTHETIC_ONLY%"=="1" exit /b 22
if not "%DATA1_EXPECTED_PROJECT_ID%"=="clean-fixture-12345678" exit /b 23
if not "%DATA1_EXPECTED_BRANCH_ID%"=="br-mock-123" exit /b 24
if not "%DATA1_EXPECTED_DATABASE%"=="synthetic_data1" exit /b 25
if not "%DATA1_EXPECTED_ROLE%"=="synthetic_data1_owner" exit /b 26
if not "%~2"=="--synthetic-only" exit /b 27
if "%~3"=="--probe" (
  if not "%DATA1_ALLOW_TEST_WRITES%"=="" exit /b 28
  exit /b 0
)
if "%~3"=="--execute" (
  if not "%~4"=="--confirm=aaaaaaaaaaaaaaaaaaaa" exit /b 29
  if not "%DATA1_ALLOW_TEST_WRITES%"=="YES_DISPOSABLE_ONLY" exit /b 30
  if exist "%~dp0fail.flag" exit /b 31
  exit /b 0
)
exit /b 32
'@
    [IO.File]::WriteAllText($mockNode, $cmd, [Text.Encoding]::ASCII)
    $env:PATH = $mockDirectory + [IO.Path]::PathSeparator + $originalPath
    # The production launcher correctly refuses CI. For this offline-only Windows
    # unit test, clear CI in the same process; use a fake node.cmd, not a database.
    $env:CI = $null
    $selectedNode = (Get-Command node -ErrorAction Stop).Source
    if ([IO.Path]::GetFullPath($selectedNode) -ine [IO.Path]::GetFullPath($mockNode)) {
        throw 'FAIL CLOSED: Windows selected real Node instead of fake local node.cmd'
    }

    Assert-Cleared
    & $launcher -Mode Probe -ProjectId $project -BranchId $branch
    if ($LASTEXITCODE -ne 0) { throw 'Probe failed' }
    Assert-Cleared
    if ($global:readHostCalls -ne 1) { throw 'Probe must ask for precisely one hidden URI' }
    Write-Host 'WIN-PROBE: PASS (fake node, no network, cleaned environment)'

    & $launcher -Mode Execute -ProjectId $project -BranchId $branch -ConfirmToken $token -AllowSyntheticWrites
    if ($LASTEXITCODE -ne 0) { throw 'Execute failed' }
    Assert-Cleared
    if ($global:readHostCalls -ne 3) { throw 'Execute must prompt for confirmation and hidden URI' }
    Write-Host 'WIN-EXECUTE: PASS (fake node, no network, cleaned environment)'

    $failFlag = Join-Path $mockDirectory 'fail.flag'
    [IO.File]::WriteAllText($failFlag, '1', [Text.Encoding]::ASCII)
    try {
        & $launcher -Mode Execute -ProjectId $project -BranchId $branch -ConfirmToken $token -AllowSyntheticWrites
        throw 'Expected fake node failure was not propagated'
    } catch {
        if ($_.Exception.Message -notmatch 'nonzero exit code: 31') { throw }
    } finally {
        Remove-Item -LiteralPath $failFlag -Force -ErrorAction SilentlyContinue
    }
    Assert-Cleared
    Write-Host 'WIN-FAILURE-CLEANUP: PASS'

    $before = $global:readHostCalls
    try {
        & $launcher -Mode Probe -ProjectId 'muddy-dust-14049657' -BranchId $branch
        throw 'Existing Neon project was not denied'
    } catch {
        if ($_.Exception.Message -notmatch 'protected FlyTally project') { throw }
    }
    if ($global:readHostCalls -ne $before) { throw 'Forbidden target prompted for a password' }
    Assert-Cleared
    Write-Host 'WIN-PROJECT-DENYLIST: PASS'

    Write-Host 'DATA-1D WINDOWS OFFLINE WRAPPER: PASS 4/4; NO NEON REQUESTS'
} finally {
    $env:PATH = $originalPath
    $env:CI = $originalCI
    Remove-Variable -Name readHostCalls -Scope Global -ErrorAction SilentlyContinue
    Remove-Variable -Name data1FakeUri -Scope Global -ErrorAction SilentlyContinue
    Remove-Item -Path Function:\Read-Host -Force -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $mockDirectory) {
        Remove-Item -LiteralPath $mockDirectory -Recurse -Force
    }
}
