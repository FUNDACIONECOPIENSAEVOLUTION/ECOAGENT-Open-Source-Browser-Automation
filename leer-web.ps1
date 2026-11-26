param([Parameter(Mandatory=$true)][string]$Url)
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$node=Join-Path $root 'tools\node-v22.23.5-win-x64\node.exe'
if(!(Test-Path -LiteralPath $node)){throw 'Node portable no encontrado'}
$env:PLAYWRIGHT_BROWSERS_PATH=Join-Path $root 'tools\browsers'
& $node (Join-Path $root 'connector\local-read.mjs') $Url
if($LASTEXITCODE -ne 0){throw 'No se pudo completar la lectura'}
