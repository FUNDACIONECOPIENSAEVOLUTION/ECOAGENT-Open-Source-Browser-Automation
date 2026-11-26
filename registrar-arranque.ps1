$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if ($root -ne 'D:\ECOAGENT') { throw 'Registrar desde D:\ECOAGENT únicamente' }
$exe = Join-Path $root 'arrancar-ecoagent.ps1'
if (-not (Test-Path $exe)) { throw 'Falta arrancar-ecoagent.ps1' }
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy RemoteSigned -File "'+$exe+'" -NoBrowser') -WorkingDirectory $root
$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName 'ECOAGENT Local' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Host 'ECOAGENT registrado para iniciar al entrar a Windows. No se abre puerto público.'
