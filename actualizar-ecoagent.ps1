param(
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$Commit
)
$ErrorActionPreference='Stop'
$repo='FUNDACIONECOPIENSAEVOLUTION/ECOAGENT-Open-Source-Browser-Automation'
$headers=@{'User-Agent'='ECOAGENT-Updater'}
$roots=@('D:\ECOAGENT','F:\ECOAGENT')
foreach($root in $roots){if(!(Test-Path -LiteralPath $root -PathType Container)){throw "Carpeta no disponible: $root"}}
foreach($port in @(8790,8791,8080,8081,8082)){if(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue){throw "Detenga ECOAGENT antes de actualizar. Puerto ocupado: $port"}}
$revision=Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/commits/$Commit" -Headers $headers
if($revision.sha -ne $Commit){throw 'Revision no coincide'}
$tree=Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/git/trees/$($revision.commit.tree.sha)?recursive=1" -Headers $headers
if($tree.truncated){throw 'Arbol incompleto'}
$entries=@($tree.tree | Where-Object {$_.type -eq 'blob' -and $_.mode -eq '100644' -and $_.path -match '^(?:(?:cloud|connector|gateway|docs|extension|scripts|test)/[A-Za-z0-9_./-]+|[A-Za-z0-9_-]+\.(?:mjs|js|css|html|ps1|md|json))$' -and $_.path -notmatch '(^|/)\.\.?(/|$)'})
if($entries.Count -lt 30 -or $entries.Count -gt 500){throw 'Lista inesperada'}
function GitBlobHash([string]$Path){
 $bytes=[IO.File]::ReadAllBytes($Path)
 $prefix=[Text.Encoding]::ASCII.GetBytes("blob $($bytes.Length)"+[char]0)
 $hash=[Security.Cryptography.SHA1]::Create()
 try{$hash.TransformBlock($prefix,0,$prefix.Length,$prefix,0)|Out-Null;$hash.TransformFinalBlock($bytes,0,$bytes.Length)|Out-Null;return ([BitConverter]::ToString($hash.Hash)).Replace('-','').ToLowerInvariant()}finally{$hash.Dispose()}
}
# Do not overwrite a running MCP server, even if it has no listening port.
$running=Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object {$_.CommandLine -match '(?i)ECOAGENT[\\/]connector[\\/]desktop\.mjs'}
if($running){throw 'Stop ECOAGENT MCP processes before updating'}
$stage=Join-Path $roots[0] ('.update-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage|Out-Null
$backup=Join-Path $roots[0] ('.source-backup-'+[guid]::NewGuid().ToString('N'))
$journal=New-Object 'System.Collections.Generic.List[object]'
$started=$false
try{
 foreach($entry in $entries){
  $p=Join-Path $stage $entry.path
  New-Item -ItemType Directory -Force -Path (Split-Path $p -Parent)|Out-Null
  $source=Join-Path $roots[0] $entry.path
  if((Test-Path -LiteralPath $source -PathType Leaf) -and (GitBlobHash $source) -eq $entry.sha){Copy-Item -LiteralPath $source -Destination $p}
  else{Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/$repo/$Commit/$($entry.path)" -OutFile $p}
  if((GitBlobHash $p) -ne $entry.sha){throw "Hash incorrecto: $($entry.path)"}
 }
 # Stage all previous files before changing either drive.
 New-Item -ItemType Directory -Path $backup|Out-Null
 foreach($root in $roots){
  foreach($entry in $entries){
   $dest=Join-Path $root $entry.path
   $saved=Join-Path (Join-Path $backup $root.Substring(0,1)) $entry.path
   $existed=Test-Path -LiteralPath $dest -PathType Leaf
   $hash=$null
   if($existed){
    New-Item -ItemType Directory -Force -Path (Split-Path $saved -Parent)|Out-Null
    Copy-Item -LiteralPath $dest -Destination $saved
    $hash=GitBlobHash $dest
    if((GitBlobHash $saved) -ne $hash){throw 'Backup hash mismatch'}
   }
   $journal.Add([pscustomobject]@{dest=$dest;saved=$saved;existed=$existed;hash=$hash})
  }
 }
 $journal|ConvertTo-Json -Depth 4|Set-Content -LiteralPath (Join-Path $backup 'journal.json') -Encoding UTF8
 $started=$true
 foreach($root in $roots){
  foreach($entry in $entries){
   $dest=Join-Path $root $entry.path
   New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent)|Out-Null
   Copy-Item -LiteralPath (Join-Path $stage $entry.path) -Destination $dest -Force
   if((GitBlobHash $dest) -ne $entry.sha){throw "Error de copia: $dest"}
  }
  Write-Host "CODIGO VERIFICADO: $root" -ForegroundColor Green
 }
}catch{
 $failure=$_.Exception.Message
 if($started){
  $errors=@()
  foreach($j in $journal){
   try{
    if($j.existed){
     Copy-Item -LiteralPath $j.saved -Destination $j.dest -Force
     if((GitBlobHash $j.dest) -ne $j.hash){throw 'Restore hash mismatch'}
    }elseif(Test-Path -LiteralPath $j.dest -PathType Leaf){Remove-Item -LiteralPath $j.dest -Force}
   }catch{$errors+= $_.Exception.Message}
  }
  if($errors.Count){throw "Update failed: $failure. Restore incomplete. Backup: $backup"}
 }
 throw "Update failed: $failure. Source backup retained: $backup"
}finally{Remove-Item -LiteralPath $stage -Recurse -Force}
Write-Host "RESPALDO CONSERVADO: $backup"
Write-Host "REVISION $Commit SINCRONIZADA. No se modificaron dependencias, perfiles ni claves." -ForegroundColor Green
