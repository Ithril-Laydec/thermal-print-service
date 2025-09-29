# Script inteligente que detecta si debe instalar o actualizar
# el servicio de impresión térmica automáticamente

#Requires -RunAsAdministrator

Write-Host ""
Write-Host "🖨️  Gestor Inteligente del Servicio de Impresión Térmica" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# Variables
$INSTALL_DIR = "C:\Program Files\ThermalPrintService"
$SERVICE_NAME = "ThermalPrintService"
$GITHUB_REPO = "https://github.com/Ithril-Laydec/thermal-print-service"
$ServiceInstalled = $false
$ServiceRunning = $false
$CurrentVersion = "desconocida"
$LatestVersion = "1.0.0"

Write-Host "🔍 Analizando estado del servicio..." -ForegroundColor Yellow
Write-Host ""

# Función para obtener versión instalada
function Get-InstalledVersion {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:20936/version" -Method Get -TimeoutSec 2
        return $response.version
    } catch {
        # Si no responde, buscar en archivos
        if (Test-Path "$INSTALL_DIR\package.json") {
            $packageJson = Get-Content "$INSTALL_DIR\package.json" | ConvertFrom-Json
            return $packageJson.version
        }
        return "desconocida"
    }
}

# Verificar si el servicio está corriendo
try {
    $response = Invoke-RestMethod -Uri "http://localhost:20936/health" -Method Get -TimeoutSec 2
    $ServiceRunning = $true
    $CurrentVersion = Get-InstalledVersion
    Write-Host "✅ Servicio detectado y funcionando" -ForegroundColor Green
    Write-Host "   Versión actual: $CurrentVersion" -ForegroundColor Gray
} catch {
    Write-Host "⚠️  Servicio no está respondiendo" -ForegroundColor Yellow
}

# Verificar instalación del servicio Windows
$existingService = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
if ($existingService) {
    $ServiceInstalled = $true
    Write-Host "📦 Servicio Windows detectado" -ForegroundColor Blue

    if ($existingService.Status -eq "Running") {
        $ServiceRunning = $true
        Write-Host "   Estado: Ejecutándose" -ForegroundColor Green
    } else {
        Write-Host "   Estado: $($existingService.Status)" -ForegroundColor Yellow
    }
}

# Verificar directorio de instalación
if (Test-Path $INSTALL_DIR) {
    $ServiceInstalled = $true
    Write-Host "📁 Instalación detectada en $INSTALL_DIR" -ForegroundColor Blue
    if ($CurrentVersion -eq "desconocida") {
        $CurrentVersion = Get-InstalledVersion
    }
}

# Verificar Node.js
Write-Host ""
Write-Host "🔍 Verificando Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js instalado ($nodeVersion)" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js no encontrado" -ForegroundColor Red
    Write-Host ""
    Write-Host "Node.js es necesario para el servicio." -ForegroundColor Yellow

    $installNode = Read-Host "¿Deseas que lo instale automáticamente? (S/N)"
    if ($installNode -eq 'S' -or $installNode -eq 's') {
        Write-Host "📥 Descargando Node.js..." -ForegroundColor Green

        # Descargar e instalar Node.js
        $nodeUrl = "https://nodejs.org/dist/v18.17.0/node-v18.17.0-x64.msi"
        $nodeMsi = "$env:TEMP\node-installer.msi"

        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi -UseBasicParsing

        Write-Host "📦 Instalando Node.js..." -ForegroundColor Green
        Start-Process msiexec.exe -ArgumentList "/i", $nodeMsi, "/quiet" -Wait

        Remove-Item $nodeMsi -Force

        # Refrescar PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

        Write-Host "✅ Node.js instalado exitosamente" -ForegroundColor Green
    } else {
        Write-Host "Por favor, instala Node.js desde: https://nodejs.org" -ForegroundColor Yellow
        Write-Host "Después ejecuta este script nuevamente" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan

# Decidir acción basada en el estado
if (-not $ServiceInstalled) {
    Write-Host "📦 INSTALACIÓN NUEVA REQUERIDA" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "El servicio no está instalado. Se procederá con la instalación completa."
    $Action = "install"
} else {
    Write-Host "🔄 VERIFICACIÓN DE ACTUALIZACIONES" -ForegroundColor Green
    Write-Host ""
    Write-Host "El servicio ya está instalado. Se verificarán actualizaciones."
    $Action = "update"
}

Write-Host ""
$confirmation = Read-Host "¿Deseas continuar? (S/N)"
if ($confirmation -ne 'S' -and $confirmation -ne 's') {
    Write-Host "Operación cancelada" -ForegroundColor Red
    exit 0
}

Write-Host ""

# Ejecutar la acción apropiada
if ($Action -eq "install") {
    Write-Host "📥 Descargando instalador..." -ForegroundColor Green

    try {
        # Descargar el instalador
        $installerUrl = "$GITHUB_REPO/raw/master/installers/install-windows.ps1"
        $tempInstaller = "$env:TEMP\install-service.ps1"

        Invoke-WebRequest -Uri $installerUrl -OutFile $tempInstaller -UseBasicParsing

        Write-Host "✅ Descarga completada" -ForegroundColor Green
        Write-Host ""
        Write-Host "🚀 Ejecutando instalación..." -ForegroundColor Green
        Write-Host ""

        # Ejecutar el instalador
        & $tempInstaller

        # Limpiar
        Remove-Item $tempInstaller -Force -ErrorAction SilentlyContinue

    } catch {
        Write-Host "❌ Error durante la instalación: $_" -ForegroundColor Red
        exit 1
    }

} else {
    Write-Host "🔍 Verificando versión más reciente..." -ForegroundColor Yellow

    try {
        # Obtener última versión desde GitHub
        $releases = Invoke-RestMethod -Uri "https://api.github.com/repos/Ithril-Laydec/thermal-print-service/releases/latest"
        $LatestVersion = $releases.tag_name -replace '^v', ''
    } catch {
        # Si falla, usar versión por defecto
        $LatestVersion = "1.0.0"
    }

    Write-Host "   Versión actual: $CurrentVersion"
    Write-Host "   Última versión: $LatestVersion"

    if ($CurrentVersion -eq $LatestVersion) {
        Write-Host ""
        Write-Host "✅ Ya tienes la última versión instalada" -ForegroundColor Green
        Write-Host ""

        # Verificar si el servicio está corriendo
        if (-not $ServiceRunning) {
            Write-Host "⚠️  El servicio no está corriendo" -ForegroundColor Yellow
            Write-Host ""
            $startService = Read-Host "¿Deseas iniciar el servicio? (S/N)"

            if ($startService -eq 'S' -or $startService -eq 's') {
                try {
                    Start-Service -Name $SERVICE_NAME
                    Write-Host "✅ Servicio iniciado exitosamente" -ForegroundColor Green
                } catch {
                    Write-Host "❌ Error iniciando el servicio: $_" -ForegroundColor Red
                }
            }
        }

    } else {
        Write-Host ""
        Write-Host "📥 Descargando actualizador..." -ForegroundColor Green

        try {
            # Descargar el actualizador
            $updaterUrl = "$GITHUB_REPO/raw/master/installers/update-service.ps1"
            $tempUpdater = "$env:TEMP\update-service.ps1"

            Invoke-WebRequest -Uri $updaterUrl -OutFile $tempUpdater -UseBasicParsing

            Write-Host "✅ Descarga completada" -ForegroundColor Green
            Write-Host ""
            Write-Host "🚀 Ejecutando actualización..." -ForegroundColor Green
            Write-Host ""

            # Ejecutar el actualizador
            & $tempUpdater

            # Limpiar
            Remove-Item $tempUpdater -Force -ErrorAction SilentlyContinue

        } catch {
            Write-Host "❌ Error durante la actualización: $_" -ForegroundColor Red
            exit 1
        }
    }
}

Write-Host ""
Write-Host "✨ Proceso completado exitosamente" -ForegroundColor Green
Write-Host ""

# Verificar estado final
Write-Host "🔍 Verificando estado final del servicio..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:20936/health" -Method Get -TimeoutSec 2
    $finalVersion = Get-InstalledVersion

    Write-Host "✅ Servicio funcionando correctamente" -ForegroundColor Green
    Write-Host "   Versión instalada: $finalVersion" -ForegroundColor Gray
    Write-Host "   URL: http://localhost:20936" -ForegroundColor Gray
} catch {
    Write-Host "⚠️  El servicio no está respondiendo" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Intenta iniciarlo manualmente:" -ForegroundColor Yellow
    Write-Host "   1. Busca 'Servicios' en el menú de Windows"
    Write-Host "   2. Busca 'ThermalPrintService'"
    Write-Host "   3. Click derecho → Iniciar"
}

Write-Host ""
Write-Host "📖 Para más información, visita:" -ForegroundColor Cyan
Write-Host "   $GITHUB_REPO" -ForegroundColor Gray
Write-Host ""
Write-Host "¡Gracias por usar el servicio de impresión térmica!" -ForegroundColor Green
Write-Host ""
Write-Host "Presiona cualquier tecla para cerrar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")