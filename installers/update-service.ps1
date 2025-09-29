# Thermal Print Service - Windows Updater
# Requires Administrator privileges

#Requires -RunAsAdministrator

Write-Host "🔄 Actualizador del Servicio de Impresión Térmica - Windows" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

$INSTALL_DIR = "C:\Program Files\ThermalPrintService"
$SERVICE_NAME = "ThermalPrintService"
$DOWNLOAD_URL = if ($env:THERMAL_SERVICE_URL) { $env:THERMAL_SERVICE_URL } else { "https://github.com/Ithril-Laydec/thermal-print-service/archive/refs/tags/latest.zip" }

if (-not (Test-Path $INSTALL_DIR)) {
    Write-Host "❌ El servicio no está instalado en $INSTALL_DIR" -ForegroundColor Red
    Write-Host "   Ejecuta install-windows.ps1 primero" -ForegroundColor Yellow
    exit 1
}

Write-Host "🔍 Verificando versión actual..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:20936/version" -Method Get
    $currentVersion = $response.version
    Write-Host "📦 Versión actual: $currentVersion" -ForegroundColor Green
} catch {
    $currentVersion = "desconocida"
    Write-Host "⚠️  No se pudo obtener la versión actual" -ForegroundColor Yellow
}

Write-Host ""
$confirmation = Read-Host "¿Continuar con la actualización? (S/N)"
if ($confirmation -ne 'S' -and $confirmation -ne 's') {
    Write-Host "Actualización cancelada" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "🛑 Deteniendo servicio..." -ForegroundColor Cyan
Stop-Service -Name $SERVICE_NAME -Force
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "💾 Creando backup..." -ForegroundColor Cyan
$BACKUP_DIR = "C:\Temp\ThermalPrintBackup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -Path $INSTALL_DIR -Destination $BACKUP_DIR -Recurse -Force
Write-Host "✅ Backup creado en $BACKUP_DIR" -ForegroundColor Green

Write-Host ""
Write-Host "📥 Descargando nueva versión..." -ForegroundColor Cyan
$TEMP_DIR = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path $_ }
$zipFile = Join-Path $TEMP_DIR "thermal-print-service.zip"

try {
    if ($DOWNLOAD_URL -match "^http") {
        Invoke-WebRequest -Uri $DOWNLOAD_URL -OutFile $zipFile
        Expand-Archive -Path $zipFile -DestinationPath $TEMP_DIR -Force
        $extractedDir = Get-ChildItem -Path $TEMP_DIR -Directory | Select-Object -First 1
    } else {
        throw "URL de descarga no válida"
    }
} catch {
    Write-Host "❌ Error descargando la actualización: $_" -ForegroundColor Red
    Write-Host "🔄 Restaurando backup..." -ForegroundColor Yellow
    Remove-Item -Path $TEMP_DIR -Recurse -Force
    Start-Service -Name $SERVICE_NAME
    exit 1
}

Write-Host ""
Write-Host "📦 Actualizando archivos..." -ForegroundColor Cyan
try {
    if ($extractedDir) {
        Remove-Item -Path "$INSTALL_DIR\*" -Recurse -Force
        Copy-Item -Path "$($extractedDir.FullName)\*" -Destination $INSTALL_DIR -Recurse -Force
    } else {
        throw "No se encontró el directorio del servicio"
    }
} catch {
    Write-Host "❌ Error actualizando archivos: $_" -ForegroundColor Red
    Write-Host "🔄 Restaurando backup..." -ForegroundColor Yellow
    Remove-Item -Path $INSTALL_DIR -Recurse -Force
    Copy-Item -Path $BACKUP_DIR -Destination $INSTALL_DIR -Recurse -Force
    Start-Service -Name $SERVICE_NAME
    Remove-Item -Path $TEMP_DIR -Recurse -Force
    exit 1
}

Write-Host ""
Write-Host "📦 Actualizando dependencias..." -ForegroundColor Cyan
Set-Location $INSTALL_DIR
& npm install --production

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error instalando dependencias" -ForegroundColor Red
    Write-Host "🔄 Restaurando backup..." -ForegroundColor Yellow
    Remove-Item -Path $INSTALL_DIR -Recurse -Force
    Copy-Item -Path $BACKUP_DIR -Destination $INSTALL_DIR -Recurse -Force
    Start-Service -Name $SERVICE_NAME
    exit 1
}

Write-Host ""
Write-Host "🚀 Reiniciando servicio..." -ForegroundColor Cyan
Start-Service -Name $SERVICE_NAME
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "🔍 Verificando nueva versión..." -ForegroundColor Cyan
$service = Get-Service -Name $SERVICE_NAME
if ($service.Status -eq 'Running') {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:20936/version" -Method Get
        $newVersion = $response.version
        Write-Host "✅ Servicio actualizado correctamente" -ForegroundColor Green
        Write-Host "📦 Versión anterior: $currentVersion" -ForegroundColor Yellow
        Write-Host "📦 Versión nueva: $newVersion" -ForegroundColor Green

        if ($currentVersion -eq $newVersion) {
            Write-Host "⚠️  Las versiones son iguales. Puede que no haya actualización disponible." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "⚠️  No se pudo verificar la nueva versión" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ El servicio no se inició correctamente" -ForegroundColor Red
    Write-Host "🔄 Restaurando backup..." -ForegroundColor Yellow
    Stop-Service -Name $SERVICE_NAME -Force
    Remove-Item -Path $INSTALL_DIR -Recurse -Force
    Copy-Item -Path $BACKUP_DIR -Destination $INSTALL_DIR -Recurse -Force
    Start-Service -Name $SERVICE_NAME
    Write-Host "✅ Backup restaurado" -ForegroundColor Green
    exit 1
}

Remove-Item -Path $TEMP_DIR -Recurse -Force

Write-Host ""
Write-Host "🗑️  Puedes eliminar el backup manualmente:" -ForegroundColor Yellow
Write-Host "   Remove-Item -Path '$BACKUP_DIR' -Recurse -Force"
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "✅ ¡Actualización completada!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan