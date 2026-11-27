[CmdletBinding()]
param([switch]$Register,[switch]$Remove,[switch]$EnableApprovalUI)
$ErrorActionPreference='Stop'
$root='D:\ECOAGENT'
$task='ECOAGENT Native Tunnel Watchdog'
$script=Join-Path $root 'scripts\watch-native-tunnel.ps1'
if($Register -and $Remove){throw 'Choose Register or Remove'}
if($Remove){
 if(Get-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue){Unregister-ScheduledTask -TaskName $task -Confirm:$false}
 Write-Host 'Watchdog removed; tunnel left unchanged.'
 return
}
if($Register){
 if(!(Test-Path -LiteralPath $script -PathType Leaf)){throw 'Install reviewed script in D:\ECOAGENT\scripts first'}
 $user=[Security.Principal.WindowsIdentity]::GetCurrent().Name
 $args='-NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File "'+$script+'"'
 if($EnableApprovalUI){$args+=' -EnableApprovalUI'}
 $action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $args -WorkingDirectory $root
 $logon=New-ScheduledTaskTrigger -AtLogOn -User $user
 $repeat=New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 365)
 $principal=New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
 $settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 3) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
 Register-ScheduledTask -TaskName $task -Action $action -Trigger @($logon,$repeat) -Principal $principal -Settings $settings -Force|Out-Null
 Write-Host 'Watchdog registered for current signed-in user; checks every five minutes for one year plus logon.'
 return
}
$tunnel=Join-Path $root 'tools\tunnel-client\tunnel-client.exe'
$profile=Join-Path $root 'local-config\tunnel-profiles'
$node=Join-Path $root 'tools\node-v22.23.5-win-x64\node.exe'
$desktop=Join-Path $root 'connector\desktop.mjs'
$state=Join-Path $root 'local-config'
foreach($p in @($tunnel,$node,$desktop,(Join-Path $root '.env.local'),$state)){
 if(!(Test-Path -LiteralPath $p)){throw 'Required existing ECOAGENT component missing'}
}
# Share the installer lock so maintenance and watchdog never run concurrently.
try{$guard=[IO.File]::Open((Join-Path $state 'maintenance.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}
catch [IO.IOException]{Write-Host 'Maintenance or watchdog active; skipping.';return}
$oldKey=[Environment]::GetEnvironmentVariable('CONTROL_PLANE_API_KEY','Process')
$oldUI=[Environment]::GetEnvironmentVariable('ECOAGENT_ENABLE_APPROVAL_UI','Process')
function Record([string]$status){
 $obj=[ordered]@{utc=[DateTime]::UtcNow.ToString('o');status=$status}
 $obj|ConvertTo-Json -Compress|Set-Content -LiteralPath (Join-Path $state 'native-watchdog-status.json') -Encoding UTF8
 Write-Host $status
}
try{
 # A ready runtime is never restarted. Ambiguous status is not enough to stop it.
 $status=(& $tunnel runtimes status ecoagent 2>&1|Out-String)
 $exit=$LASTEXITCODE
 if($exit -eq 0 -and $status -match '\bready\b' -and $status -notmatch '(?i)\bnot\s+ready\b'){Record 'ready';return}
 $list=(& $tunnel runtimes list 2>&1|Out-String)
 if($LASTEXITCODE -ne 0 -or $list -notmatch '(?m)^ecoagent[ \t]+(tunnel_[a-zA-Z0-9]+)[ \t]*\r?$'){Record 'existing_alias_unavailable';return}
 $id=$Matches[1]
 # Do not stop any existing runtime or kill a process. Let the official client reconnect.
 $line=Get-Content -LiteralPath (Join-Path $root '.env.local')|Where-Object {$_ -match '^\s*CONTROL_PLANE_API_KEY\s*='}|Select-Object -First 1
 if(!$line){Record 'credential_missing';return}
 $env:CONTROL_PLANE_API_KEY=($line -split '=',2)[1].Trim().Trim('"').Trim("'")
 if(!$env:CONTROL_PLANE_API_KEY){Record 'credential_empty';return}
 if($EnableApprovalUI){$env:ECOAGENT_ENABLE_APPROVAL_UI='1'}
 $null= & $tunnel runtimes connect --alias ecoagent --tunnel-id $id --profile ecoagent --profile-dir $profile --runtime-api-key 'env:CONTROL_PLANE_API_KEY' --mcp-command 'D:/ECOAGENT/tools/node-v22.23.5-win-x64/node.exe D:/ECOAGENT/connector/desktop.mjs' 2>&1
 if($LASTEXITCODE -ne 0){Record 'connect_failed';return}
 for($i=0;$i -lt 15;$i++){
  $s=(& $tunnel runtimes status ecoagent 2>&1|Out-String)
  if($LASTEXITCODE -eq 0 -and $s -match '\bready\b' -and $s -notmatch '(?i)\bnot\s+ready\b'){Record 'reconnected';return}
  Start-Sleep -Seconds 2
 }
 Record 'connection_not_ready'
}catch{Record 'watchdog_error';throw 'ECOAGENT watchdog failed; no credentials printed.'}
finally{
 [Environment]::SetEnvironmentVariable('CONTROL_PLANE_API_KEY',$oldKey,'Process')
 [Environment]::SetEnvironmentVariable('ECOAGENT_ENABLE_APPROVAL_UI',$oldUI,'Process')
 $guard.Dispose()
}
