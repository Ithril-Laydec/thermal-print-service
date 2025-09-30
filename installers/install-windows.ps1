# Thermal Print Service - Windows Installer
# Requires Administrator privileges

#Requires -RunAsAdministrator

Write-Host "🖨️  Instalador del Servicio de Impresión Térmica - Windows" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

$INSTALL_DIR = "C:\Program Files\ThermalPrintService"
$SERVICE_NAME = "ThermalPrintService"
$DOWNLOAD_URL = if ($env:THERMAL_SERVICE_URL) { $env:THERMAL_SERVICE_URL } else { "https://github.com/Ithril-Laydec/thermal-print-service/archive/refs/tags/v1.0.0.zip" }

Write-Host "📋 Configuración:" -ForegroundColor Yellow
Write-Host "   Directorio: $INSTALL_DIR"
Write-Host "   Servicio: $SERVICE_NAME"
Write-Host "   URL: $DOWNLOAD_URL"
Write-Host ""

$confirmation = Read-Host "¿Continuar con la instalación? (S/N)"
if ($confirmation -ne 'S' -and $confirmation -ne 's') {
    Write-Host "Instalación cancelada" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "🔍 Verificando Bun..." -ForegroundColor Cyan
try {
    $bunVersion = bun --version
    Write-Host "✅ Bun ya está instalado ($bunVersion)" -ForegroundColor Green
} catch {
    Write-Host "❌ Bun no encontrado. Instalando..." -ForegroundColor Yellow
    try {
        irm bun.sh/install.ps1 | iex
        $env:Path = "$env:USERPROFILE\.bun\bin;$env:Path"
        Write-Host "✅ Bun instalado" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error instalando Bun" -ForegroundColor Red
        Write-Host "Instala Bun manualmente desde: https://bun.sh" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "🔍 Verificando servicio existente..." -ForegroundColor Cyan
$existingService = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "⚠️  Servicio existente detectado. Deteniéndolo..." -ForegroundColor Yellow
    Stop-Service -Name $SERVICE_NAME -Force
    & sc.exe delete $SERVICE_NAME
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "📥 Descargando servicio de impresión..." -ForegroundColor Cyan
$TEMP_DIR = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path $_ }
$zipFile = Join-Path $TEMP_DIR "thermal-print-service.zip"

try {
    if ($DOWNLOAD_URL -match "^http") {
        Invoke-WebRequest -Uri $DOWNLOAD_URL -OutFile $zipFile
        Expand-Archive -Path $zipFile -DestinationPath $TEMP_DIR -Force
        $extractedDir = Get-ChildItem -Path $TEMP_DIR -Directory | Select-Object -First 1
    } else {
        Write-Host "⚠️  URL no proporcionada. Usando instalación local..." -ForegroundColor Yellow
        $extractedDir = $TEMP_DIR
    }
} catch {
    Write-Host "❌ Error descargando el servicio: $_" -ForegroundColor Red
    Remove-Item -Path $TEMP_DIR -Recurse -Force
    exit 1
}

Write-Host ""
Write-Host "📦 Instalando en $INSTALL_DIR..." -ForegroundColor Cyan
if (Test-Path $INSTALL_DIR) {
    Remove-Item -Path $INSTALL_DIR -Recurse -Force
}
New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null

if ($extractedDir) {
    Copy-Item -Path "$($extractedDir.FullName)\*" -Destination $INSTALL_DIR -Recurse -Force
} else {
    Write-Host "❌ Error: No se encontró el directorio del servicio" -ForegroundColor Red
    Remove-Item -Path $TEMP_DIR -Recurse -Force
    exit 1
}

Write-Host ""
Write-Host "📦 Instalando dependencias..." -ForegroundColor Cyan
Set-Location $INSTALL_DIR
& bun install --production

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error instalando dependencias" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔧 Configurando servicio de Windows..." -ForegroundColor Cyan

$bunExe = (Get-Command bun).Source
$serverJs = Join-Path $INSTALL_DIR "server.js"

& sc.exe create $SERVICE_NAME binPath= "`"$bunExe`" `"$serverJs`"" start= auto DisplayName= "Thermal Print Service"
& sc.exe description $SERVICE_NAME "Servicio local para impresión térmica ESC/POS"
& sc.exe failure $SERVICE_NAME reset= 86400 actions= restart/5000/restart/5000/restart/5000

Write-Host "✅ Servicio de Windows creado" -ForegroundColor Green

Write-Host ""
Write-Host "🚀 Iniciando servicio..." -ForegroundColor Cyan
Start-Service -Name $SERVICE_NAME
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "🔍 Verificando estado del servicio..." -ForegroundColor Cyan
$service = Get-Service -Name $SERVICE_NAME
if ($service.Status -eq 'Running') {
    Write-Host "✅ Servicio iniciado correctamente" -ForegroundColor Green

    try {
        $response = Invoke-RestMethod -Uri "http://localhost:20936/version" -Method Get
        Write-Host "📦 Versión instalada: $($response.version)" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  No se pudo verificar la versión (el servicio puede estar iniciándose)" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  El servicio no se inició correctamente" -ForegroundColor Yellow
    Write-Host "Estado: $($service.Status)" -ForegroundColor Yellow
}

Remove-Item -Path $TEMP_DIR -Recurse -Force

Write-Host ""
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host "✅ ¡Instalación completada!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Comandos útiles:" -ForegroundColor Yellow
Write-Host "   Get-Service ThermalPrintService           # Ver estado"
Write-Host "   Restart-Service ThermalPrintService       # Reiniciar"
Write-Host "   Stop-Service ThermalPrintService          # Detener"
Write-Host "   Get-EventLog -LogName Application -Source ThermalPrintService  # Ver logs"
Write-Host ""
Write-Host "🌐 El servicio está disponible en: http://localhost:20936" -ForegroundColor Cyan
Write-Host "🎯 Endpoints:" -ForegroundColor Cyan
Write-Host "   GET  http://localhost:20936/health"
Write-Host "   GET  http://localhost:20936/version"
Write-Host "   POST http://localhost:20936/print/ticket"
Write-Host ""
Write-Host "💡 El servicio se iniciará automáticamente al arrancar Windows" -ForegroundColor Green
Write-Host "=============================================================" -ForegroundColor Cyan