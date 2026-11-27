# ECOAGENT - diagnostico de solo lectura
# No detiene procesos, no instala, no expone ni modifica credenciales.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$roots = @('D:\ECOAGENT', 'F:\ECOAGENT')
$results = @()
foreach ($root in $roots) {
    $found = Test-Path -LiteralPath $root -PathType Container
    $desktop = Join-Path $root 'connector\desktop.mjs'
    $version = 'no encontrada'
    $registeredTools = $null
    if ($found -and (Test-Path -LiteralPath $desktop -PathType Leaf)) {
        $source = Get-Content -LiteralPath $desktop -Raw -Encoding UTF8
        $match = [regex]::Match($source, "new McpServer\(\{name:'ecoagent-local',version:'([^']+)'\}\)")
        if ($match.Success) { $version = $match.Groups[1].Value }
        $registeredTools = [regex]::Matches($source, "server\.tool\('ecoagent_").Count
    }
    $results += [pscustomobject]@{
        unidad = $root.Substring(0, 1)
        carpeta_existe = $found
        version_mcp_en_archivo = $version
        herramientas_registradas_en_codigo = $registeredTools
    }
}
$primary = 'D:\ECOAGENT'
$node = Join-Path $primary 'tools\node-v22.23.5-win-x64\node.exe'
$tunnel = Join-Path $primary 'tools\tunnel-client\tunnel-client.exe'
$nodeResult = 'no encontrado'
if (Test-Path -LiteralPath $node -PathType Leaf) {
    try {
        $nodeResult = (& $node --version 2>$null | Select-Object -First 1)
        if ($LASTEXITCODE -ne 0) { $nodeResult = 'error al ejecutar' }
    } catch { $nodeResult = 'error al ejecutar' }
}
$tunnelResult = 'cliente no encontrado'
if (Test-Path -LiteralPath $tunnel -PathType Leaf) {
    try {
        # Capturamos la salida, pero NO la imprimimos: podria incluir datos de conexion.
        $tunnelStatus = (& $tunnel runtimes status ecoagent 2>&1 | Out-String)
        $tunnelResult = if ($LASTEXITCODE -eq 0 -and $tunnelStatus -match '(?i)\bready\b') { 'ready' } else { 'no ready / revisar servicio' }
    } catch { $tunnelResult = 'error al consultar servicio' }
}
$ports = @()
foreach ($port in @(8790, 8791, 8793, 8080, 8081, 8082)) {
    $listening = $false
    try { $listening = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue).Count -gt 0 } catch {}
    $ports += [pscustomobject]@{ puerto = $port; escucha = $listening }
}
$diagnostic = [ordered]@{
    diagnostico = 'ECOAGENT local - lectura segura'
    fecha_local = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    instalaciones = $results
    node = $nodeResult
    tunnel_alias_ecoagent = $tunnelResult
    puertos = $ports
    notas = @(
        'El numero de herramientas en el codigo no confirma que ChatGPT Web las vea.',
        'No se leyeron ni mostraron claves, archivos .env, identificadores de tunel ni cookies.',
        'Este diagnostico no instala, reinicia ni actualiza ningun componente.'
    )
}
$diagnostic | ConvertTo-Json -Depth 6
