$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PSScriptRoot 'private\browsers'
node server.mjs
