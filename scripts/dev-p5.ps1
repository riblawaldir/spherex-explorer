# Arranque local del worktree. No mata procesos ajenos.
# Detener solo lo que este script inició: .\scripts\dev-p5.ps1 -Stop
param(
    [switch]$Stop
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$StateDir = Join-Path $Root ".p5-dev"
$PidFile = Join-Path $StateDir "pids.json"
$BackendPort = 8000
$FrontendPort = 5173

function Get-CommandLine([int]$ProcessId) {
    $row = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
    if ($null -eq $row) { return "" }
    return [string]$row.CommandLine
}

function Stop-OwnedProcess([int]$ProcessId) {
    $command = Get-CommandLine $ProcessId
    if (-not $command) {
        Write-Host "PID $ProcessId ya no existe."
        return
    }
    if ($command -notlike "*$Root*") {
        Write-Host "PID $ProcessId no pertenece a este worktree. No se detiene."
        return
    }
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    Write-Host "Detenido PID $ProcessId"
}

if ($Stop) {
    if (-not (Test-Path $PidFile)) {
        Write-Host "No hay servidores registrados en $PidFile"
        exit 0
    }
    $saved = Get-Content $PidFile -Raw | ConvertFrom-Json
    foreach ($name in @("backend", "frontend")) {
        $processId = [int]$saved.$name
        if ($processId -gt 0) { Stop-OwnedProcess $processId }
    }
    Remove-Item $PidFile -ErrorAction SilentlyContinue
    exit 0
}

function Test-Listening([int]$Port) {
    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $listeners
}

foreach ($port in @($BackendPort, $FrontendPort)) {
    if (Test-Listening $port) {
        Write-Host "El puerto $port ya está en uso. No se detiene ese proceso."
        Write-Host "Libera el puerto o ejecuta .\scripts\dev-p5.ps1 -Stop si lo inició este script."
        exit 1
    }
}

$pythonCmd = Get-Command py -ErrorAction SilentlyContinue
$python = $null
if ($pythonCmd) { $python = "py" }
else {
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCmd) { $python = "python" }
}
if (-not $python) {
    Write-Host "No hay Python en PATH."
    exit 1
}
$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $node -or -not $npm) {
    Write-Host "No hay Node.js o npm en PATH."
    exit 1
}

$venvPython = Join-Path $Root "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "Creando entorno virtual en backend\.venv"
    if ($python -eq "py") {
        & py -3.12 -m venv (Join-Path $Root "backend\.venv")
        if ($LASTEXITCODE -ne 0) { & py -3 -m venv (Join-Path $Root "backend\.venv") }
    } else {
        & python -m venv (Join-Path $Root "backend\.venv")
    }
}
if (-not (Test-Path $venvPython)) {
    Write-Host "No se pudo crear el entorno virtual."
    exit 1
}

& $venvPython -c "import fastapi, uvicorn, astropy, reproject" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Instalando dependencias del backend en el entorno local"
    & $venvPython -m pip install -r (Join-Path $Root "backend\requirements.txt")
    & $venvPython -m pip install -r (Join-Path $Root "backend\requirements-dev.txt")
}

$nodeModules = Join-Path $Root "frontend\node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Host "Instalando dependencias del frontend"
    Push-Location (Join-Path $Root "frontend")
    & npm ci
    $npmCode = $LASTEXITCODE
    Pop-Location
    if ($npmCode -ne 0) { exit $npmCode }
}

$manifest = Join-Path $env:USERPROFILE "Downloads\spherex_real_fits_p5\manifiesto_local_p5.json"
$env:SPHEREX_P5_LOCAL_MANIFEST = $manifest
& $venvPython (Join-Path $Root "scripts\prepare_local_manifest.py")
if ($LASTEXITCODE -ne 0) {
    Write-Host "Sin manifiesto local. El backend arranca solo con fixtures."
    Remove-Item Env:SPHEREX_P5_LOCAL_MANIFEST -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
$backendLog = Join-Path $StateDir "backend.log"
$frontendLog = Join-Path $StateDir "frontend.log"

$backend = Start-Process -FilePath $venvPython `
    -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$BackendPort") `
    -WorkingDirectory (Join-Path $Root "backend") `
    -RedirectStandardOutput $backendLog `
    -RedirectStandardError (Join-Path $StateDir "backend.err.log") `
    -PassThru -WindowStyle Hidden

$npmCmd = (Get-Command npm).Source
$frontend = Start-Process -FilePath $npmCmd `
    -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "$FrontendPort", "--strictPort") `
    -WorkingDirectory (Join-Path $Root "frontend") `
    -RedirectStandardOutput $frontendLog `
    -RedirectStandardError (Join-Path $StateDir "frontend.err.log") `
    -PassThru -WindowStyle Hidden

@{ backend = $backend.Id; frontend = $frontend.Id } | ConvertTo-Json | Set-Content $PidFile -Encoding utf8

$healthy = $false
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 1
    try {
        $health = Invoke-WebRequest -Uri "http://127.0.0.1:$BackendPort/health" -UseBasicParsing -TimeoutSec 2
        if ($health.StatusCode -eq 200) { $healthy = $true; break }
    } catch { }
}
if (-not $healthy) {
    Write-Host "El backend no respondió en http://127.0.0.1:$BackendPort/health"
    Write-Host "Revisa $backendLog"
    exit 1
}

$frontendOk = $false
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 1
    try {
        $page = Invoke-WebRequest -Uri "http://127.0.0.1:$FrontendPort/" -UseBasicParsing -TimeoutSec 2
        if ($page.StatusCode -eq 200) { $frontendOk = $true; break }
    } catch { }
}
if (-not $frontendOk) {
    Write-Host "El frontend no respondió en http://127.0.0.1:$FrontendPort/"
    Write-Host "Revisa $frontendLog"
    exit 1
}

Write-Host "Backend  http://127.0.0.1:$BackendPort/health"
Write-Host "Frontend http://127.0.0.1:$FrontendPort/"
Start-Process "http://127.0.0.1:$FrontendPort/"
Write-Host "Servidores en marcha. Para detenerlos: .\scripts\dev-p5.ps1 -Stop"
