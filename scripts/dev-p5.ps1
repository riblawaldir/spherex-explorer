# Arranque local del worktree. No mata procesos ajenos.
# Detener solo lo que este script inició: .\scripts\dev-p5.ps1 -Stop
param(
    [switch]$Stop
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$StateDir = Join-Path $Root ".p5-dev"
$PidFile = Join-Path $StateDir "pids.json"

function Get-CommandLine([int]$ProcessId) {
    $row = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
    if ($null -eq $row) { return "" }
    return [string]$row.CommandLine
}

function Test-OwnedProcess([int]$ProcessId) {
    $command = Get-CommandLine $ProcessId
    return ($command -and $command -like "*$Root*")
}

function Stop-OwnedProcess([int]$ProcessId) {
    if (-not (Test-OwnedProcess $ProcessId)) {
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

function Get-Listeners([int]$Port) {
    return @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Resolve-Port([int]$Start, [int]$Span) {
    for ($port = $Start; $port -lt ($Start + $Span); $port++) {
        $listeners = @(Get-Listeners $port)
        if ($listeners.Count -eq 0) {
            return @{ Port = $port; Owned = $false }
        }
        $foreign = @($listeners | Where-Object { -not (Test-OwnedProcess $_.OwningProcess) })
        if ($foreign.Count -eq 0) {
            return @{ Port = $port; Owned = $true }
        }
        Write-Host "Puerto $port ocupado por otro proceso. No se detiene."
    }
    return $null
}

function Stop-OwnedPort([int]$Port) {
    foreach ($listener in (Get-Listeners $Port)) {
        Stop-OwnedProcess ([int]$listener.OwningProcess)
    }
    for ($i = 0; $i -lt 40; $i++) {
        if ((Get-Listeners $Port).Count -eq 0) { return $true }
        Start-Sleep -Milliseconds 250
    }
    return ((Get-Listeners $Port).Count -eq 0)
}

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "No hay Node.js en PATH."
    exit 1
}
$nodeExe = $nodeCmd.Source
$npmCmd = Join-Path (Split-Path -Parent $nodeExe) "npm.cmd"
if (-not (Test-Path $npmCmd)) {
    Write-Host "No se encontró npm.cmd junto a node.exe. No se usa npm.ps1."
    exit 1
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
$viteJs = Join-Path $Root "frontend\node_modules\vite\bin\vite.js"
if (-not (Test-Path $viteJs)) {
    Write-Host "Instalando dependencias del frontend"
    Push-Location (Join-Path $Root "frontend")
    & $npmCmd ci
    $npmCode = $LASTEXITCODE
    Pop-Location
    if ($npmCode -ne 0) { exit $npmCode }
}
if (-not (Test-Path $viteJs)) {
    Write-Host "No está el ejecutable de Vite: $viteJs"
    exit 1
}

$backendChoice = Resolve-Port -Start 8000 -Span 20
$frontendChoice = Resolve-Port -Start 5173 -Span 20
if (-not $backendChoice -or -not $frontendChoice) {
    Write-Host "No hay puertos libres junto a 8000 y 5173. No se detuvo ningún proceso ajeno."
    exit 1
}
$BackendPort = [int]$backendChoice.Port
$FrontendPort = [int]$frontendChoice.Port
if ($BackendPort -ne 8000 -or $FrontendPort -ne 5173) {
    Write-Host "Puertos de este worktree: backend $BackendPort, frontend $FrontendPort"
}

$manifest = Join-Path $env:USERPROFILE "Downloads\spherex_real_fits_p5\manifiesto_local_p5.json"
$env:SPHEREX_P5_LOCAL_MANIFEST = $manifest
& $venvPython (Join-Path $Root "scripts\prepare_local_manifest.py")
if ($LASTEXITCODE -ne 0) {
    Write-Host "Sin manifiesto local. El backend arranca solo con fixtures."
    Remove-Item Env:SPHEREX_P5_LOCAL_MANIFEST -ErrorAction SilentlyContinue
}

$env:VITE_API_PROXY = "http://127.0.0.1:$BackendPort"

New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
$backendLog = Join-Path $StateDir "backend.log"
$frontendLog = Join-Path $StateDir "frontend.log"

$backendPid = 0
if ($backendChoice.Owned) {
    try {
        $existing = Invoke-WebRequest -Uri "http://127.0.0.1:$BackendPort/health" -UseBasicParsing -TimeoutSec 3
        if ($existing.StatusCode -eq 200) {
            $backendPid = [int]@(Get-Listeners $BackendPort)[0].OwningProcess
            Write-Host "Reutilizando el backend de este worktree en el puerto $BackendPort (PID $backendPid)"
        }
    } catch { }
    if ($backendPid -eq 0) {
        if (-not (Stop-OwnedPort $BackendPort)) {
            Write-Host "No se pudo liberar el puerto $BackendPort de este worktree."
            exit 1
        }
    }
}
if ($backendPid -eq 0) {
    $backend = Start-Process -FilePath $venvPython `
        -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$BackendPort") `
        -WorkingDirectory (Join-Path $Root "backend") `
        -RedirectStandardOutput $backendLog `
        -RedirectStandardError (Join-Path $StateDir "backend.err.log") `
        -PassThru -WindowStyle Hidden
    $backendPid = [int]$backend.Id
}

$frontendPid = 0
$reuseFrontend = $false
if ($frontendChoice.Owned -and (Test-Path $PidFile)) {
    $saved = Get-Content $PidFile -Raw | ConvertFrom-Json
    $sameApi = [string]$saved.api -eq $env:VITE_API_PROXY
    $samePort = [int]$saved.frontendPort -eq $FrontendPort
    $recorded = 0
    try { $recorded = [int]$saved.frontend } catch { $recorded = 0 }
    if ($sameApi -and $samePort -and $recorded -gt 0 -and (Test-OwnedProcess $recorded)) {
        $reuseFrontend = $true
        $frontendPid = $recorded
        Write-Host "Reutilizando Vite de este worktree en el puerto $FrontendPort (PID $frontendPid)"
    }
}
if (-not $reuseFrontend -and $frontendChoice.Owned) {
    Write-Host "Reiniciando Vite de este worktree en el puerto $FrontendPort para usar $env:VITE_API_PROXY"
    if (-not (Stop-OwnedPort $FrontendPort)) {
        Write-Host "El puerto $FrontendPort sigue ocupado por un proceso que no se puede detener."
        exit 1
    }
}
if ($frontendPid -eq 0) {
    $frontend = Start-Process -FilePath $nodeExe `
        -ArgumentList @($viteJs, "--host", "127.0.0.1", "--port", "$FrontendPort", "--strictPort") `
        -WorkingDirectory (Join-Path $Root "frontend") `
        -RedirectStandardOutput $frontendLog `
        -RedirectStandardError (Join-Path $StateDir "frontend.err.log") `
        -PassThru -WindowStyle Hidden
    $frontendPid = [int]$frontend.Id
}

@{
    backend = $backendPid
    frontend = $frontendPid
    backendPort = $BackendPort
    frontendPort = $FrontendPort
    api = $env:VITE_API_PROXY
    root = $Root
} | ConvertTo-Json | Set-Content $PidFile -Encoding utf8

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

$proxyOk = $false
try {
    $proxied = Invoke-WebRequest -Uri "http://127.0.0.1:$FrontendPort/health" -UseBasicParsing -TimeoutSec 5
    $proxyOk = ($proxied.StatusCode -eq 200 -and $proxied.Content -match "ok")
} catch { }
if (-not $proxyOk) {
    Write-Host "El frontend no reenvía /health al backend de este worktree."
    exit 1
}

Write-Host "Backend  http://127.0.0.1:$BackendPort/health"
Write-Host "Frontend http://127.0.0.1:$FrontendPort/"
Write-Host "Proxy    $env:VITE_API_PROXY"
Start-Process "http://127.0.0.1:$FrontendPort/"
Write-Host "Servidores en marcha. Para detenerlos: .\scripts\dev-p5.ps1 -Stop"
