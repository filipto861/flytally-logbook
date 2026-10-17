# I2-B1 WINDOWS POWERSHELL 5.1 PARSE-ONLY GATE.
# No database access, binary execution, services, ACL edits, filesystem writes.
# Parses the separate inventory script but does not execute its contents.
param([switch]$ParseOnly)
$ErrorActionPreference = 'Stop'
try {
    if (-not $ParseOnly) { throw 'ParseOnly flag required' }
    if ($PSVersionTable.PSVersion.Major -ne 5 -or
        $PSVersionTable.PSVersion.Minor -lt 1) {
        throw 'Windows PowerShell 5.1 required'
    }
    $candidate = Join-Path $PSScriptRoot 'read-native-pg16-i2b1-inventory.ps1'
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        throw 'Inventory script source unavailable'
    }

    $tokens = $null
    $parseErrors = $null
    [System.Management.Automation.Language.Parser]::ParseFile(
        $candidate, [ref]$tokens, [ref]$parseErrors
    ) | Out-Null
    if ($null -eq $parseErrors -or $parseErrors.Count -ne 0) {
        throw 'Inventory script AST parse failed'
    }

    # Self-falsification: a deliberately invalid in-memory script MUST fail.
    $negativeTokens = $null
    $negativeErrors = $null
    [System.Management.Automation.Language.Parser]::ParseInput(
        'if (', [ref]$negativeTokens, [ref]$negativeErrors
    ) | Out-Null
    if ($null -eq $negativeErrors -or $negativeErrors.Count -lt 1) {
        throw 'PS5 parser negative control unexpectedly accepted invalid syntax'
    }

    Write-Output 'I2-B1 Windows PowerShell 5.1 PARSE ONLY: PASS'
    Write-Output 'No inventory executed. PostgreSQL RLS NOT RUN.'
} catch {
    [Console]::Error.WriteLine(
        'I2-B1 Windows PowerShell 5.1 PARSE ONLY: FAIL. No inventory executed.'
    )
    exit 1
}
