$ErrorActionPreference = 'Stop'
$repo = 'https://github.com/FUNDACIONECOPIENSAEVOLUTION/ECOAGENT-Open-Source-Browser-Automation'
$zipUrl = "$repo/archive/refs/heads/main.zip"
$targets = @('D:\ECOAGENT','F:\ECOAGENT')
foreach ($target in $targets) {
  $drive = Split-Path -Qualifier $target
  if (-not (Test-Path "$drive\")) { throw "Disco no disponible: $drive" }
}
$temp = Join-Path ([IO.Path]::GetTempPath()) ("ecoagent-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $temp | Out-Null
try {
  $zip = Join-Path $temp 'source.zip'
  Invoke-WebRequest -Uri $zipUrl -OutFile $zip
  Expand-Archive -LiteralPath $zip -DestinationPath $temp
  $source = Join-Path $temp 'ECOAGENT-Open-Source-Browser-Automation-main'
  if (-not (Test-Path (Join-Path $source 'extension\manifest.json'))) { throw 'Descarga incompleta' }
  foreach ($target in $targets) {
    if (Test-Path (Join-Path $target '.git')) {
      Write-Warning "Repositorio Git existente: $target. No se sobrescribe. Actualice con git pull --ff-only."
      continue
    }
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    Get-ChildItem -LiteralPath $source -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $target -Recurse -Force }
    Write-Host "Código copiado: $target"
  }
} finally { Remove-Item -LiteralPath $temp -Recurse -Force }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Warning 'Instale Node.js 22 LTS o superior para usar el puente. La extensión no lo necesita.' }
else { node --version }
Write-Host 'Instalación principal: D:\ECOAGENT'
Write-Host 'Respaldo de código: F:\ECOAGENT'
Write-Host 'Cargue D:\ECOAGENT\extension en chrome://extensions'
Write-Host 'Para arrancar: powershell -ExecutionPolicy Bypass -File D:\ECOAGENT\iniciar-bridge.ps1'
