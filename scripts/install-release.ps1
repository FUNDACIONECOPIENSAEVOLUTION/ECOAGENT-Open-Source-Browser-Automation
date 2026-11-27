param(
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$Commit,
 [switch]$ConfirmIdle
)
$ErrorActionPreference='Stop'
if(!$ConfirmIdle){throw 'Confirm idle maintenance using -ConfirmIdle'}
$root='D:\ECOAGENT'
$roots=@($root,'F:\ECOAGENT')
$repo='FUNDACIONECOPIENSAEVOLUTION/ECOAGENT-Open-Source-Browser-Automation'
$api="https://api.github.com/repos/$repo"
$headers=@{'User-Agent'='ECOAGENT-maintenance'}
$tunnel=Join-Path $root 'tools\tunnel-client\tunnel-client.exe'
$profileDir=Join-Path $root 'local-config\tunnel-profiles'
foreach($r in $roots){if(!(Test-Path $r -PathType Container)){throw "Missing drive: $r"}}
$state=Join-Path $root 'local-config'
New-Item -ItemType Directory -Force $state|Out-Null
$lock=[IO.File]::Open((Join-Path $state 'maintenance.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
$priorKey=[Environment]::GetEnvironmentVariable('CONTROL_PLANE_API_KEY','Process')
$stopped=$false;$modified=$false;$newStarted=$false
$journal=@()
$work=Join-Path $root ('.maintenance-'+[guid]::NewGuid().ToString('N'))
function Hash([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash}
function Blob([string]$p){
 $b=[IO.File]::ReadAllBytes($p);$prefix=[Text.Encoding]::ASCII.GetBytes("blob $($b.Length)"+[char]0)
 $h=[Security.Cryptography.SHA1]::Create()
 try{$h.TransformBlock($prefix,0,$prefix.Length,$prefix,0)|Out-Null;$h.TransformFinalBlock($b,0,$b.Length)|Out-Null;([BitConverter]::ToString($h.Hash)).Replace('-','').ToLowerInvariant()}finally{$h.Dispose()}
}
function Ready {
 $s=(& $tunnel runtimes status ecoagent|Out-String)
 return ($LASTEXITCODE -eq 0 -and $s -match '\bready\b')
}
function Start-Ecoagent {
 & $tunnel runtimes connect --alias ecoagent --tunnel-id $tunnelId --profile ecoagent --profile-dir $profileDir --runtime-api-key 'env:CONTROL_PLANE_API_KEY' --mcp-command 'D:/ECOAGENT/tools/node-v22.23.5-win-x64/node.exe D:/ECOAGENT/connector/desktop.mjs'
 if($LASTEXITCODE -ne 0){throw 'Tunnel connect failed'}
 for($i=0;$i -lt 15;$i++){if(Ready){return};Start-Sleep -Seconds 2}
 throw 'Tunnel not ready'
}
try{
 $runs=Invoke-RestMethod "$api/actions/runs?head_sha=$Commit&event=push&per_page=100" -Headers $headers -TimeoutSec 30
 if(!(@($runs.workflow_runs|Where-Object {$_.head_sha -eq $Commit -and $_.name -eq 'ECOAGENT verification' -and $_.status -eq 'completed' -and $_.conclusion -eq 'success'}).Count)){throw 'CI has not passed for exact revision'}
 $revision=Invoke-RestMethod "$api/commits/$Commit" -Headers $headers -TimeoutSec 30
 if($revision.sha -ne $Commit){throw 'Revision mismatch'}
 $tree=Invoke-RestMethod "$api/git/trees/$($revision.commit.tree.sha)?recursive=1" -Headers $headers -TimeoutSec 30
 if($tree.truncated){throw 'Incomplete tree'}
 $entries=@($tree.tree|Where-Object {$_.type -eq 'blob' -and $_.mode -eq '100644' -and $_.path -match '^(?:(?:cloud|connector|gateway|docs|extension|scripts|test)/[A-Za-z0-9_./-]+|[A-Za-z0-9_-]+\.(?:mjs|js|css|html|ps1|md|json))$' -and $_.path -notmatch '(^|/)\.\.?(/|$)'})
 if($entries.Count -lt 30 -or $entries.Count -gt 500){throw 'Unexpected source list'}
 New-Item -ItemType Directory -Path $work|Out-Null
 $stage=Join-Path $work 'stage'
 foreach($e in $entries){
  $p=Join-Path $stage $e.path
  New-Item -ItemType Directory -Force (Split-Path $p -Parent)|Out-Null
  $source=Join-Path $root $e.path
  if((Test-Path -LiteralPath $source -PathType Leaf) -and (Blob $source) -eq $e.sha){Copy-Item -LiteralPath $source -Destination $p}
  else{Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/$repo/$Commit/$($e.path)" -OutFile $p -TimeoutSec 60}
  if((Blob $p) -ne $e.sha){throw "Source hash mismatch: $($e.path)"}
  if($p.EndsWith('.ps1')){ $tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseFile($p,[ref]$tokens,[ref]$errors)|Out-Null;if($errors.Count){throw "PowerShell syntax error: $($e.path)"}}
 }
 $runtime=(& $tunnel runtimes list|Out-String)
 if($LASTEXITCODE -ne 0 -or $runtime -notmatch '(?m)^ecoagent[ \t]+(tunnel_[a-zA-Z0-9]+)[ \t]*\r?$'){throw 'Existing ecoagent alias not found'}
 $tunnelId=$Matches[1]
 if(!(Ready)){throw 'Existing runtime not ready'}
 $line=Get-Content (Join-Path $root '.env.local')|Where-Object {$_ -match '^\s*CONTROL_PLANE_API_KEY\s*='}|Select-Object -First 1
 if(!$line){throw 'Existing credential missing'}
 $env:CONTROL_PLANE_API_KEY=($line -split '=',2)[1].Trim().Trim('"').Trim("'")
 if(!$env:CONTROL_PLANE_API_KEY){throw 'Empty runtime credential'}
 foreach($port in @(8790,8791,8080,8081,8082)){if(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue){throw "Other ECOAGENT service active: $port"}}
 # Stop only the managed alias after download and syntax checks.
 & $tunnel runtimes stop ecoagent
 if($LASTEXITCODE -ne 0){throw 'Could not stop managed runtime'}
 $stopped=$true
 $running=Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"|Where-Object {$_.CommandLine -match '(?i)ECOAGENT[\\/]connector[\\/]desktop\.mjs'}
 if($running){throw 'Another ECOAGENT MCP process is active; close it manually'}
 foreach($r in $roots){
  foreach($e in $entries){
   $dest=Join-Path $r $e.path
   $saved=Join-Path (Join-Path $work $r.Substring(0,1)) $e.path
   $exists=Test-Path -LiteralPath $dest -PathType Leaf
   $hash=$null
   if($exists){
    New-Item -ItemType Directory -Force (Split-Path $saved -Parent)|Out-Null
    Copy-Item -LiteralPath $dest -Destination $saved
    $hash=Hash $dest
    if((Hash $saved) -ne $hash){throw 'Backup hash mismatch'}
   }
   $journal+= [pscustomobject]@{dest=$dest;saved=$saved;existed=$exists;hash=$hash}
  }
 }
 $journal|ConvertTo-Json -Depth 4|Set-Content (Join-Path $work 'journal.json') -Encoding UTF8
 $modified=$true
 foreach($r in $roots){
  foreach($e in $entries){
   $dest=Join-Path $r $e.path
   New-Item -ItemType Directory -Force (Split-Path $dest -Parent)|Out-Null
   Copy-Item -LiteralPath (Join-Path $stage $e.path) -Destination $dest -Force
   if((Blob $dest) -ne $e.sha){throw 'Copy hash mismatch'}
  }
  Push-Location $r
  try{
   $n=Join-Path $r 'tools\node-v22.23.5-win-x64\node.exe'
   & $n --test test/*.test.mjs cloud/*.test.mjs connector/*.test.mjs gateway/*.test.mjs
   if($LASTEXITCODE -ne 0){throw "Unit tests failed: $r"}
   & $n connector/desktop.integration.mjs --fixture
   if($LASTEXITCODE -ne 0){throw "MCP browser fixture failed: $r"}
  }finally{Pop-Location}
 }
 $newStarted=$true
 Start-Ecoagent
 Write-Host "ECOAGENT UPDATED: $Commit; backup retained: $work" -ForegroundColor Green
}catch{
 $failure=$_.Exception.Message
 if($newStarted){& $tunnel runtimes stop ecoagent;if($LASTEXITCODE -ne 0){throw "Cannot stop new runtime; manual recovery required: $work"}}
 if($modified){
  foreach($j in $journal){
   if($j.existed){Copy-Item -LiteralPath $j.saved -Destination $j.dest -Force;if((Hash $j.dest) -ne $j.hash){throw "Restore verification failed: $work"}}
   elseif(Test-Path -LiteralPath $j.dest -PathType Leaf){Remove-Item -LiteralPath $j.dest -Force}
  }
 }
 if($stopped){Start-Ecoagent}
 throw "Maintenance failed: $failure. Backup retained if created: $work"
}finally{
 if($null -eq $priorKey){Remove-Item Env:CONTROL_PLANE_API_KEY -ErrorAction SilentlyContinue}else{$env:CONTROL_PLANE_API_KEY=$priorKey}
 $lock.Dispose()
}
