param([switch]$Apply,[switch]$InstallSchedule,[string]$MaintenanceTime='03:00')
$ErrorActionPreference='Stop'
$root='D:\ECOAGENT'
$repo='FUNDACIONECOPIENSAEVOLUTION/ECOAGENT-Open-Source-Browser-Automation'
$api="https://api.github.com/repos/$repo"
$headers=@{'User-Agent'='ECOAGENT-release-updater';Accept='application/vnd.github+json'}
$stateDir=Join-Path $root 'local-config'
$state=Join-Path $stateDir 'installed-release.json'
$lock=Join-Path $stateDir 'release-update.lock'
if($InstallSchedule){
 if($Apply){throw 'Unattended installation disabled until idle coordination is validated. Register check-only schedule without -Apply.'}
 $when=[datetime]::ParseExact($MaintenanceTime,'HH:mm',[Globalization.CultureInfo]::InvariantCulture)
 $action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -NonInteractive -File "D:\ECOAGENT\scripts\auto-update.ps1"' -WorkingDirectory $root
 $trigger=New-ScheduledTaskTrigger -Daily -At $when
 $principal=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
 $settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 20)
 Register-ScheduledTask -TaskName 'ECOAGENT Release Update' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force|Out-Null
 Write-Host 'Schedule registered for current user only. Published stable releases only.'
 return
}
New-Item -ItemType Directory -Force -Path $stateDir|Out-Null
$guard=[IO.File]::Open($lock,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
try{
 try{$release=Invoke-RestMethod -Uri "$api/releases/latest" -Headers $headers -TimeoutSec 30}catch{if($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 404){Write-Host 'No stable release published. Nothing to update.';return};throw}
 if($release.draft -or $release.prerelease -or $release.tag_name -notmatch '^v\d+\.\d+\.\d+$'){throw 'Invalid release'}
 $tag=$release.tag_name
 $rev=Invoke-RestMethod -Uri "$api/commits/$tag" -Headers $headers -TimeoutSec 30
 $sha=$rev.sha
 if($sha -notmatch '^[a-f0-9]{40}$'){throw 'Invalid revision'}
 $compare=Invoke-RestMethod -Uri "$api/compare/$sha...main" -Headers $headers -TimeoutSec 30
 if($compare.status -notin @('ahead','identical')){throw 'Release not on main history'}
 $runs=Invoke-RestMethod -Uri "$api/actions/runs?head_sha=$sha&event=push&per_page=100" -Headers $headers -TimeoutSec 30
 if(!(@($runs.workflow_runs|Where-Object {$_.head_sha -eq $sha -and $_.name -eq 'ECOAGENT verification' -and $_.status -eq 'completed' -and $_.conclusion -eq 'success'}).Count)){throw 'No successful verification for release'}
 if(Test-Path $state){
  $previous=Get-Content $state -Raw|ConvertFrom-Json
  if($previous.sha -eq $sha){Write-Host "Already installed: $tag";return}
  if([version]($previous.tag.TrimStart('v')) -ge [version]($tag.TrimStart('v'))){throw 'Downgrade or changed release tag refused'}
 }elseif(!$Apply){Write-Host 'No installed release recorded yet'}
 Write-Host "Verified release candidate: $tag $sha"
 if($Apply){throw 'Use manually confirmed install-release.ps1; automatic installation not enabled'}
 Write-Host 'Check only: no files changed or services stopped.'
}finally{$guard.Dispose()}
