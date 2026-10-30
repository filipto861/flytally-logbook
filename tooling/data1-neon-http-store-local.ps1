# DATA-1D: owner-local, interactive secret handling for the standalone Neon HTTP acceptance gate.
# This script NEVER creates or deletes a project, and does not persist a connection URL.
# The operator must independently prove that the project was newly created and is disposable.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Probe', 'Execute')]
    [string]$Mode,

    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [Parameter(Mandatory = $true)]
    [string]$BranchId,

    [string]$ConfirmToken = '',

    [switch]$AllowSyntheticWrites
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Nothing in this helper can establish the actual Neon project ID from SQL.
# Compare the values with the Neon console BEFORE running either mode.
if ($ProjectId -notmatch '^[a-z]+-[a-z]+-[0-9]{5,}$' -or
    $BranchId -notmatch '^br-[a-z0-9-]+$') {
    throw 'Refused: invalid disposable project/branch identifier.'
}
if ($ProjectId -in @('muddy-dust-14049657', 'frosty-recipe-46458686', 'dry-king-94424047')) {
    throw 'Refused: this is an existing protected FlyTally project, not a disposable database.'
}
if ($Mode -eq 'Execute') {
    if (-not $AllowSyntheticWrites -or $ConfirmToken -notmatch '^[a-f0-9]{20}$') {
        throw 'Refused: Execute requires -AllowSyntheticWrites and a probe confirmation token.'
    }
} elseif ($AllowSyntheticWrites -or $ConfirmToken) {
    throw 'Refused: Probe must not carry write authorization.'
}

$managedVariables = @(
    'DATABASE_URL', 'DATA1_SYNTHETIC_ONLY', 'DATA1_EXPECTED_PROJECT_ID',
    'DATA1_EXPECTED_BRANCH_ID', 'DATA1_EXPECTED_DATABASE',
    'DATA1_EXPECTED_ROLE', 'DATA1_ALLOW_TEST_WRITES'
)
foreach ($variable in $managedVariables) {
    if ([Environment]::GetEnvironmentVariable($variable, 'Process')) {
        throw ('Refused: inherited environment variable is already set: ' + $variable +
            '. Use a fresh PowerShell session with no database credentials loaded.')
    }
}
foreach ($variable in @('CI', 'VERCEL', 'VERCEL_ENV', 'NEON_DATABASE_URL', 'PGHOST', 'NODE_OPTIONS')) {
    if ([Environment]::GetEnvironmentVariable($variable, 'Process')) {
        throw ('Refused: inherited execution context is set: ' + $variable)
    }
}

$nodeCommand = Get-Command node -ErrorAction Stop
$nodeVersion = (& $nodeCommand.Source --version)
if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v24\.') {
    throw 'Node.js 24 is required.'
}
$gateScript = Join-Path $PSScriptRoot 'data1-neon-http-store-gate.mjs'
if (-not (Test-Path -LiteralPath $gateScript -PathType Leaf)) {
    throw 'DATA-1D gate file is missing from this checkout.'
}

Write-Host 'DATA-1D — disposable Neon project only, never Logbook Shadow or Training.'
Write-Host 'Confirm the project and branch in Neon Console independently:'
Write-Host ('  Project ID: ' + $ProjectId)
Write-Host ('  Branch ID:  ' + $BranchId)
if ($Mode -eq 'Execute') {
    $reply = Read-Host 'Type EXECUTE to confirm writes to the newly created empty disposable project'
    if ($reply -cne 'EXECUTE') {
        throw 'Refused: interactive write confirmation was not given.'
    }
}

$secret = $null
$pointer = [IntPtr]::Zero
$plain = $null
try {
    # Hidden prompt: the URI never appears in the script's command line or GitHub/ChatGPT tools.
    $secret = Read-Host 'Paste ONLY the disposable Neon DATABASE_URL (input hidden)' -AsSecureString
    if ($null -eq $secret -or $secret.Length -eq 0) {
        throw 'No disposable database URL was provided.'
    }
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)

    [Environment]::SetEnvironmentVariable('DATABASE_URL', $plain, 'Process')
    [Environment]::SetEnvironmentVariable('DATA1_SYNTHETIC_ONLY', '1', 'Process')
    [Environment]::SetEnvironmentVariable('DATA1_EXPECTED_PROJECT_ID', $ProjectId, 'Process')
    [Environment]::SetEnvironmentVariable('DATA1_EXPECTED_BRANCH_ID', $BranchId, 'Process')
    [Environment]::SetEnvironmentVariable('DATA1_EXPECTED_DATABASE', 'synthetic_data1', 'Process')
    [Environment]::SetEnvironmentVariable('DATA1_EXPECTED_ROLE', 'synthetic_data1_owner', 'Process')

    if ($Mode -eq 'Execute') {
        [Environment]::SetEnvironmentVariable('DATA1_ALLOW_TEST_WRITES', 'YES_DISPOSABLE_ONLY', 'Process')
        & $nodeCommand.Source $gateScript '--synthetic-only' '--execute' ('--confirm=' + $ConfirmToken)
    } else {
        & $nodeCommand.Source $gateScript '--synthetic-only' '--probe'
    }
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw ('DATA-1D gate stopped with nonzero exit code: ' + $exitCode)
    }
} finally {
    # Clear the temporary process environment even if the test fails or is interrupted.
    foreach ($variable in $managedVariables) {
        [Environment]::SetEnvironmentVariable($variable, $null, 'Process')
    }
    if ($pointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
    $plain = $null
    $secret = $null
}
# This wrapper does not delete the test project: that requires separate exact-ID verification.
