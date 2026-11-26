param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$node = Get-ChildItem (Join-Path $PSScriptRoot 'tools') -Directory -Filter 'node-v22*-win-x64' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
if (-not $node) { throw 'Node portable 22 no encontrado' }
$exe = Join-Path $node.FullName 'node.exe'
$env:PATH = "$($node.FullName);$env:PATH"
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PSScriptRoot 'tools\browsers'
$env:npm_config_cache = Join-Path $PSScriptRoot 'tools\npm-cache'
if (-not (Test-Path (Join-Path $PSScriptRoot 'node_modules\playwright'))) { throw 'Instale dependencias Playwright primero' }
if (Get-NetTCPConnection -LocalPort 8790 -State Listen -ErrorAction SilentlyContinue) { throw 'Puerto 8790 ocupado. Compruebe el servidor existente antes de iniciar otro.' }
if (-not $NoBrowser) { Start-Process powershell.exe -ArgumentList '-NoProfile','-Command','Start-Sleep -Seconds 3; Start-Process http://127.0.0.1:8790' }
& $exe (Join-Path $PSScriptRoot 'server.mjs')
