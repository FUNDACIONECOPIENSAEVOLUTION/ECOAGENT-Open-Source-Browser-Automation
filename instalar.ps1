$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Instale Node.js 22 LTS o superior, o añada su versión portable al PATH.' }
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PSScriptRoot 'private\browsers'
npm install
if ($LASTEXITCODE -ne 0) { throw 'npm install falló' }
npx playwright install chromium
if ($LASTEXITCODE -ne 0) { throw 'Chromium no se instaló' }
npm test
if ($LASTEXITCODE -ne 0) { throw 'Pruebas fallidas' }
