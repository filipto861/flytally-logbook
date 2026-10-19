# FlyTally R3-P1A owner-local six-KML research inspector.
# READ ONLY; no GPS positions, original times/altitudes, filenames or paths printed.
# Run from the Logbook repository root on the R3-P1A research branch.
$ErrorActionPreference='Stop'
$cwd=(Get-Location).Path
$quality=Join-Path $cwd 'tooling\gps-v2-d43-r2-quality.mjs'
$inspector=Join-Path $cwd 'tooling\gps-v2-r3-p1a-quality-contexts.mjs'
if(-not (Test-Path -LiteralPath $quality -PathType Leaf) -or
   -not (Test-Path -LiteralPath $inspector -PathType Leaf)){
 Write-Host 'UNAVAILABLE: Open the Logbook repository on the P1A branch.'
 exit 2
}
try{Add-Type -AssemblyName System.Windows.Forms}catch{
 Write-Host 'UNAVAILABLE: File picker not available.';exit 2
}
$dialog=New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title='FlyTally P1A: choose all six original KML recordings'
$dialog.Filter='KML files (*.kml)|*.kml'
$dialog.Multiselect=$true
$downloads=Join-Path $env:USERPROFILE 'Downloads'
if(Test-Path -LiteralPath $downloads -PathType Container){$dialog.InitialDirectory=$downloads}
$choice=$dialog.ShowDialog()
$files=@($dialog.FileNames)
$dialog.Dispose()
if($choice -ne [System.Windows.Forms.DialogResult]::OK -or $files.Count -ne 6){
 Write-Host 'UNAVAILABLE: Choose exactly six KML files.';exit 2
}
$signatures=@{
 '2:948'='sample03';'2:587'='sample04';'3:893'='sample05'
 '2:74'='sample06';'2:593'='sample07';'2:1034'='sample08'
}
$seen=@{}
$out=New-Object System.Collections.Generic.List[object]
foreach($file in $files){
 $qLines=& node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types $quality --file $file --id sample99 2>$null
 if($LASTEXITCODE -ne 0){Write-Host 'UNAVAILABLE: Original source quality validation failed.';exit 2}
 try{$q=($qLines -join [Environment]::NewLine)|ConvertFrom-Json -ErrorAction Stop}catch{
  Write-Host 'UNAVAILABLE: Invalid source quality summary.';exit 2
 }
 if($q.status -ne 'SOURCE_ALTITUDE_QUALITY_DIAGNOSTIC_ONLY'){
  Write-Host 'UNAVAILABLE: Source unsupported.';exit 2
 }
 $key='{0}:{1}' -f $q.sourceBlocks,$q.canonicalFixes
 $id=$signatures[$key]
 if(-not $id -or $seen.ContainsKey($id)){
  Write-Host 'UNAVAILABLE: Unexpected or duplicate source identity.';exit 2
 }
 $seen[$id]=$true
 $lines=& node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types $inspector --file $file --id $id 2>$null
 if($LASTEXITCODE -ne 0){
  Write-Host ('UNAVAILABLE: P1A diagnostic failed for '+$id);exit 2
 }
 try{$r=($lines -join [Environment]::NewLine)|ConvertFrom-Json -ErrorAction Stop}catch{
  Write-Host 'UNAVAILABLE: Invalid P1A summary.';exit 2
 }
 if(@('QUALITY_REVIEW_ONLY','NO_QUALIFYING_DIAGNOSTIC') -notcontains $r.status -or
    $r.referenceStatus -ne 'FROZEN_REJECTION_COUNT_PARITY_VERIFIED' -or
    $r.actualLandings -ne 'UNAVAILABLE' -or $r.canAffectCanonicalFlight -ne $false){
  Write-Host ('UNAVAILABLE: P1A contract failed for '+$id);exit 2
 }
 # Strict allowlist. Never print raw CLI output or file identity.
 $out.Add([pscustomobject]@{
  sample=$id;status=$r.status
  sourceQualityContexts=$r.sourceQualityContexts
  frozenLegacyRejectedGeometryWindows=$r.frozenLegacyRejectedGeometryWindows
  sharedEdgeWindows=$r.sharedEdgeWindows
  longIntervalContextCount=$r.longIntervalContextCount
  referenceStatus=$r.referenceStatus
  actualLandings=$r.actualLandings
  canAffectCanonicalFlight=$r.canAffectCanonicalFlight
 })
}
if($out.Count -ne 6 -or $seen.Count -ne 6){
 Write-Host 'UNAVAILABLE: Incomplete six-track corpus.';exit 2
}
Write-Host 'FlyTally R3-P1A: anonymized source-altitude quality contexts'
Write-Host 'This does NOT confirm Touch & Go or change any flight record.'
$out|Sort-Object sample|ConvertTo-Json -Depth 4
