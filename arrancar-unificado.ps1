$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$node = Get-ChildItem (Join-Path $PSScriptRoot 'tools') -Directory -Filter 'node-v22*-win-x64' | Sort-Object Name -Descending | Select-Object -First 1
if (-not $node) { throw 'Node portable no encontrado' }
$env:PATH = "$($node.FullName);$env:PATH"
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PSScriptRoot 'tools\browsers'
& (Join-Path $node.FullName 'node.exe') (Join-Path $PSScriptRoot 'unified.mjs')
