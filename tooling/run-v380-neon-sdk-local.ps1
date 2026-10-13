# Run ONLY against a separately seeded disposable Neon child branch.
# Requires PowerShell 5.1+, Node 24, and the plain Neon connection URI in clipboard.
param(
  [Parameter(Mandatory=$true)][string]$ExpectedHost,
  [Parameter(Mandatory=$true)][string]$ExpectedBranchId,
  [Parameter(Mandatory=$true)][string]$ExpectedNonce
)
$ErrorActionPreference = "Stop"
$envKeys = @(
  "FLYTALLY_NEON_SDK_TEST_URL",
  "FLYTALLY_NEON_SDK_TEST_HOST",
  "FLYTALLY_NEON_SDK_TEST_BRANCH_ID",
  "FLYTALLY_NEON_SDK_TEST_NONCE",
  "FLYTALLY_NEON_SDK_DISPOSABLE_ONLY"
)
try {
  if ($ExpectedHost -notmatch '^[a-z0-9.-]+\.neon\.tech$') { throw "Invalid expected Neon endpoint hostname." }
  if ($ExpectedBranchId -notmatch '^br-[a-z0-9-]{8,}$') { throw "Invalid disposable branch ID." }
  if ($ExpectedNonce -notmatch '^[a-f0-9]{8}-[a-f0-9-]{27,}$') { throw "Invalid fixture nonce." }

  $raw = Get-Clipboard -Raw
  if ([string]::IsNullOrWhiteSpace($raw)) {
    throw "Clipboard is empty. Use Neon Dashboard > temporary branch > Connect > copy connection string URI."
  }
  $candidate = $raw.Trim()
  if ($candidate -notmatch '^postgres(?:ql)?://\S+$') {
    throw "Clipboard is not a plain postgresql:// URI. Copy only the URI, NOT the psql command, label or documentation."
  }
  $uri = $null
  if (-not [System.Uri]::TryCreate($candidate, [System.UriKind]::Absolute, [ref]$uri)) {
    throw "Clipboard contains a malformed PostgreSQL URI. Copy the temporary Neon connection URI again."
  }
  if ($uri.Host -cne $ExpectedHost) {
    throw "Clipboard URI points at another Neon host. Test cancelled BEFORE any remote write."
  }
  if ($uri.AbsolutePath -cne "/neondb") {
    throw "Clipboard URI points at an unexpected database. Expected the isolated neondb."
  }

  $env:FLYTALLY_NEON_SDK_TEST_URL = $candidate
  $env:FLYTALLY_NEON_SDK_TEST_HOST = $ExpectedHost
  $env:FLYTALLY_NEON_SDK_TEST_BRANCH_ID = $ExpectedBranchId
  $env:FLYTALLY_NEON_SDK_TEST_NONCE = $ExpectedNonce
  $env:FLYTALLY_NEON_SDK_DISPOSABLE_ONLY = "isolated-branch-only"

  Write-Host "Local URI format and pinned Neon host verified. Credentials are not printed."
  & node .\tooling\verify-v380-neon-http-sdk.mjs
  if ($LASTEXITCODE -ne 0) {
    throw "Neon SDK test failed (exit code $LASTEXITCODE). Share only non-secret test output."
  }
} finally {
  foreach ($name in $envKeys) {
    Remove-Item ("Env:" + $name) -ErrorAction SilentlyContinue
  }
  # Windows PowerShell 5.1 can reject an empty string in Set-Clipboard.
  # Replace potential credential contents with one space rather than ''.
  try { Set-Clipboard -Value " " -ErrorAction Stop } catch {
    Write-Warning "Clipboard could not be cleared automatically. Clear it manually; do not paste the URI into chat."
  }
}
