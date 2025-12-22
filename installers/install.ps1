# Thermal Print Service - Unified Installer/Updater for Windows
# Automatically detects whether to install or update

# Ensure stderr from native commands doesn't terminate the script
$ErrorActionPreference = 'Continue'

# ============================================================
# AUTO-ELEVATION: Request admin privileges if not running as admin
# ============================================================
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Solicitando permisos de administrador..." -ForegroundColor Yellow

    $scriptUrl = "https://github.com/Ithril-Laydec/thermal-print-service/raw/master/installers/install.ps1"
    $tempScript = "$env:TEMP\thermal-print-install.ps1"

    try {
        # Download with proper UTF-8 encoding
        $response = Invoke-WebRequest -Uri $scriptUrl -UseBasicParsing
        [System.IO.File]::WriteAllText($tempScript, $response.Content, [System.Text.Encoding]::UTF8)

        # Use EncodedCommand to avoid all escaping issues with special characters
        $command = ". '$tempScript'"
        $bytes = [System.Text.Encoding]::Unicode.GetBytes($command)
        $encodedCommand = [Convert]::ToBase64String($bytes)

        Start-Process powershell.exe -ArgumentList "-NoExit -ExecutionPolicy Bypass -EncodedCommand $encodedCommand" -Verb RunAs -Wait
        Remove-Item $tempScript -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Host "Error: Se requieren permisos de administrador" -ForegroundColor Red
        Write-Host "   Ejecuta PowerShell como Administrador e intenta de nuevo" -ForegroundColor Yellow
    }
    exit
}

Write-Host ""
Write-Host "🖨️  Servicio de Impresión Térmica - Windows" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# Variables
$INSTALL_DIR = "C:\Program Files\ThermalPrintService"
$SERVICE_NAME = "ThermalPrintService"
$GITHUB_REPO = "https://github.com/Ithril-Laydec/thermal-print-service"
$ServiceRunning = $false
$IsUpdate = $false
$CurrentVersion = "desconocida"

# Function to get installed version
function Get-InstalledVersion {
    try {
        $response = Invoke-RestMethod -Uri "https://localhost:20936/version" -Method Get -TimeoutSec 2 -SkipCertificateCheck
        return $response.version
    } catch {
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:20936/version" -Method Get -TimeoutSec 2
            return $response.version
        } catch {
            if (Test-Path "$INSTALL_DIR\package.json") {
                $packageJson = Get-Content "$INSTALL_DIR\package.json" | ConvertFrom-Json
                return $packageJson.version
            }
            return "desconocida"
        }
    }
}

# ============================================================
# DETECT CURRENT STATE
# ============================================================
Write-Host "🔍 Analizando estado del sistema..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "https://localhost:20936/health" -Method Get -TimeoutSec 2 -SkipCertificateCheck
    $ServiceRunning = $true
    $CurrentVersion = Get-InstalledVersion
    Write-Host "✅ Servicio detectado (HTTPS) - v$CurrentVersion" -ForegroundColor Green
} catch {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:20936/health" -Method Get -TimeoutSec 2
        $ServiceRunning = $true
        $CurrentVersion = Get-InstalledVersion
        Write-Host "✅ Servicio detectado (HTTP) - v$CurrentVersion" -ForegroundColor Green
    } catch {
        # Service not running
    }
}

$existingService = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
if ($existingService -or (Test-Path $INSTALL_DIR)) {
    $IsUpdate = $true
    if ($CurrentVersion -eq "desconocida") {
        $CurrentVersion = Get-InstalledVersion
    }
    Write-Host "📦 Instalación existente detectada" -ForegroundColor Blue
}

Write-Host ""

# ============================================================
# INSTALL BUN
# ============================================================
Write-Host "🔍 Verificando Bun..." -ForegroundColor Yellow
try {
    $bunVersion = bun --version
    Write-Host "✅ Bun $bunVersion" -ForegroundColor Green
} catch {
    Write-Host "📦 Instalando Bun..." -ForegroundColor Yellow
    try {
        irm bun.sh/install.ps1 | iex
        $env:Path = "$env:USERPROFILE\.bun\bin;$env:Path"
        Write-Host "✅ Bun instalado" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error instalando Bun" -ForegroundColor Red
        Write-Host "Instala Bun desde: https://bun.sh" -ForegroundColor Yellow
        exit 1
    }
}

# ============================================================
# INSTALL MKCERT
# ============================================================
Write-Host ""
Write-Host "🔒 Verificando mkcert..." -ForegroundColor Yellow
try {
    $mkcertVersion = mkcert -version
    Write-Host "✅ mkcert instalado" -ForegroundColor Green
} catch {
    Write-Host "📦 Instalando mkcert..." -ForegroundColor Yellow
    $mkcertUrl = "https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-windows-amd64.exe"
    $mkcertPath = "C:\Windows\System32\mkcert.exe"
    try {
        Invoke-WebRequest -Uri $mkcertUrl -OutFile $mkcertPath -UseBasicParsing
        Write-Host "✅ mkcert instalado" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  No se pudo instalar mkcert - continuando sin HTTPS" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🔐 Instalando Certificate Authority local..." -ForegroundColor Yellow
try {
    & mkcert -install
    Write-Host "✅ CA local instalada" -ForegroundColor Green
} catch {
    Write-Host "⚠️  No se pudo instalar la CA local" -ForegroundColor Yellow
}

# ============================================================
# BACKUP AND STOP SERVICE (if updating)
# ============================================================
$BACKUP_DIR = ""
if ($IsUpdate) {
    Write-Host ""
    Write-Host "🛑 Deteniendo servicio..." -ForegroundColor Yellow
    try {
        Stop-Service -Name $SERVICE_NAME -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    } catch {}

    if (Test-Path $INSTALL_DIR) {
        Write-Host ""
        Write-Host "💾 Creando backup..." -ForegroundColor Yellow
        $BACKUP_DIR = "C:\Temp\ThermalPrintBackup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        New-Item -ItemType Directory -Path "C:\Temp" -Force -ErrorAction SilentlyContinue | Out-Null
        Copy-Item -Path $INSTALL_DIR -Destination $BACKUP_DIR -Recurse -Force
        Write-Host "✅ Backup en $BACKUP_DIR" -ForegroundColor Green
    }

    # Remove existing service (try NSSM first, then sc.exe as fallback)
    Write-Host ""
    Write-Host "🗑️  Eliminando servicio anterior..." -ForegroundColor Yellow
    $existingNssm = Join-Path $INSTALL_DIR "nssm.exe"
    if (Test-Path $existingNssm) {
        try { & $existingNssm stop $SERVICE_NAME 2>&1 | Out-Null } catch {}
        try { & $existingNssm remove $SERVICE_NAME confirm 2>&1 | Out-Null } catch {}
    }
    # Always try sc.exe as fallback (handles services created with New-Service)
    try { & "$env:SystemRoot\System32\sc.exe" delete $SERVICE_NAME 2>&1 | Out-Null } catch {}
    Start-Sleep -Seconds 2
}

# ============================================================
# DOWNLOAD SERVICE
# ============================================================
Write-Host ""
Write-Host "📥 Descargando servicio..." -ForegroundColor Yellow
$TEMP_DIR = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path $_ }
$zipFile = Join-Path $TEMP_DIR "thermal-print-service.zip"

try {
    # Get latest release
    $releases = Invoke-RestMethod -Uri "$GITHUB_REPO/releases/latest" -Headers @{"Accept"="application/json"}
    $latestTag = $releases.tag_name
    $DOWNLOAD_URL = "$GITHUB_REPO/archive/refs/tags/$latestTag.zip"
} catch {
    $DOWNLOAD_URL = "$GITHUB_REPO/archive/refs/heads/master.zip"
}

try {
    Invoke-WebRequest -Uri $DOWNLOAD_URL -OutFile $zipFile -UseBasicParsing
    Expand-Archive -Path $zipFile -DestinationPath $TEMP_DIR -Force
    $extractedDir = Get-ChildItem -Path $TEMP_DIR -Directory | Select-Object -First 1
} catch {
    Write-Host "❌ Error descargando el servicio: $_" -ForegroundColor Red
    if ($IsUpdate -and $BACKUP_DIR) {
        Write-Host "🔄 Restaurando backup..." -ForegroundColor Yellow
        Copy-Item -Path $BACKUP_DIR -Destination $INSTALL_DIR -Recurse -Force
    }
    Remove-Item -Path $TEMP_DIR -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}

# ============================================================
# INSTALL FILES
# ============================================================
Write-Host ""
Write-Host "📦 Instalando en $INSTALL_DIR..." -ForegroundColor Yellow

# Change directory to avoid "directory in use" error
Set-Location $env:SystemRoot

if (Test-Path $INSTALL_DIR) {
    Remove-Item -Path $INSTALL_DIR -Recurse -Force
}
New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null

if ($extractedDir) {
    Copy-Item -Path "$($extractedDir.FullName)\*" -Destination $INSTALL_DIR -Recurse -Force
} else {
    Write-Host "❌ Error: No se encontró el directorio del servicio" -ForegroundColor Red
    Remove-Item -Path $TEMP_DIR -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}

# ============================================================
# INSTALL DEPENDENCIES
# ============================================================
Write-Host ""
Write-Host "📦 Instalando dependencias..." -ForegroundColor Yellow
Set-Location $INSTALL_DIR
Remove-Item -Path "package-lock.json" -ErrorAction SilentlyContinue
Remove-Item -Path "bun.lockb" -ErrorAction SilentlyContinue

# Use cmd.exe to run bun to bypass PowerShell stderr handling
$bunResult = Start-Process -FilePath "cmd.exe" -ArgumentList "/c bun install --production" -Wait -NoNewWindow -PassThru
if ($bunResult.ExitCode -ne 0) {
    Write-Host "❌ Error instalando dependencias" -ForegroundColor Red
    if ($IsUpdate -and $BACKUP_DIR) {
        Write-Host "🔄 Restaurando backup..." -ForegroundColor Yellow
        Remove-Item -Path $INSTALL_DIR -Recurse -Force
        Copy-Item -Path $BACKUP_DIR -Destination $INSTALL_DIR -Recurse -Force
    }
    exit 1
}

# ============================================================
# GENERATE SSL CERTIFICATES
# ============================================================
Write-Host ""
Write-Host "🔒 Generando certificados SSL..." -ForegroundColor Yellow
Set-Location $INSTALL_DIR
try {
    if (-not (Test-Path "$INSTALL_DIR\localhost+2.pem") -or -not (Test-Path "$INSTALL_DIR\localhost+2-key.pem")) {
        & mkcert localhost 127.0.0.1 ::1
        Write-Host "✅ Certificados SSL generados" -ForegroundColor Green
    } else {
        Write-Host "✅ Certificados SSL existentes" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  No se pudieron generar certificados" -ForegroundColor Yellow
}

# ============================================================
# COPY BUN TO INSTALL DIR (so SYSTEM account can access it)
# ============================================================
Write-Host ""
Write-Host "📦 Copiando Bun al directorio de instalación..." -ForegroundColor Yellow
$bunSource = (Get-Command bun).Source
$bunDest = Join-Path $INSTALL_DIR "bun.exe"
Copy-Item -Path $bunSource -Destination $bunDest -Force
Write-Host "✅ Bun copiado" -ForegroundColor Green

# ============================================================
# INSTALL NSSM (service wrapper)
# ============================================================
Write-Host ""
Write-Host "📦 Instalando NSSM (service wrapper)..." -ForegroundColor Yellow
$nssmPath = Join-Path $INSTALL_DIR "nssm.exe"

if (-not (Test-Path $nssmPath)) {
    $nssmZipUrl = "https://nssm.cc/release/nssm-2.24.zip"
    $nssmZip = Join-Path $env:TEMP "nssm.zip"
    $nssmExtract = Join-Path $env:TEMP "nssm-extract"

    try {
        Invoke-WebRequest -Uri $nssmZipUrl -OutFile $nssmZip -UseBasicParsing
        Expand-Archive -Path $nssmZip -DestinationPath $nssmExtract -Force

        # Copy the 64-bit version
        $nssmExe = Join-Path $nssmExtract "nssm-2.24\win64\nssm.exe"
        if (-not (Test-Path $nssmExe)) {
            $nssmExe = Join-Path $nssmExtract "nssm-2.24\win32\nssm.exe"
        }
        Copy-Item -Path $nssmExe -Destination $nssmPath -Force

        Remove-Item $nssmZip -Force -ErrorAction SilentlyContinue
        Remove-Item $nssmExtract -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "✅ NSSM instalado" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error instalando NSSM: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ NSSM ya existe" -ForegroundColor Green
}

# ============================================================
# CONFIGURE WINDOWS SERVICE (using NSSM)
# ============================================================
Write-Host ""
Write-Host "🔧 Configurando servicio de Windows..." -ForegroundColor Yellow

$serverJs = Join-Path $INSTALL_DIR "server.js"

# Install service with NSSM (suppress all output)
try { & $nssmPath install $SERVICE_NAME $bunDest $serverJs 2>&1 | Out-Null } catch {}
try { & $nssmPath set $SERVICE_NAME AppDirectory $INSTALL_DIR 2>&1 | Out-Null } catch {}
try { & $nssmPath set $SERVICE_NAME DisplayName "Thermal Print Service" 2>&1 | Out-Null } catch {}
try { & $nssmPath set $SERVICE_NAME Description "Servicio local para impresión térmica ESC/POS" 2>&1 | Out-Null } catch {}
try { & $nssmPath set $SERVICE_NAME Start SERVICE_AUTO_START 2>&1 | Out-Null } catch {}
try { & $nssmPath set $SERVICE_NAME AppStdout (Join-Path $INSTALL_DIR "service.log") 2>&1 | Out-Null } catch {}
try { & $nssmPath set $SERVICE_NAME AppStderr (Join-Path $INSTALL_DIR "service-error.log") 2>&1 | Out-Null } catch {}
try { & $nssmPath set $SERVICE_NAME AppRotateFiles 1 2>&1 | Out-Null } catch {}
try { & $nssmPath set $SERVICE_NAME AppRotateBytes 1048576 2>&1 | Out-Null } catch {}

Write-Host "✅ Servicio de Windows configurado" -ForegroundColor Green

# ============================================================
# START SERVICE
# ============================================================
Write-Host ""
Write-Host "🚀 Iniciando servicio..." -ForegroundColor Yellow
try {
    Start-Service -Name $SERVICE_NAME -ErrorAction Stop
    Start-Sleep -Seconds 3
} catch {
    Write-Host "❌ Error al iniciar servicio: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "📋 Diagnóstico:" -ForegroundColor Yellow

    # Check if files exist
    Write-Host "   Archivos en $INSTALL_DIR`:" -ForegroundColor Gray
    Get-ChildItem $INSTALL_DIR -Name | ForEach-Object { Write-Host "   - $_" -ForegroundColor Gray }

    # Check error log
    $errorLog = Join-Path $INSTALL_DIR "service-error.log"
    if (Test-Path $errorLog) {
        Write-Host ""
        Write-Host "   Log de errores:" -ForegroundColor Gray
        Get-Content $errorLog -Tail 10 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    }

    # Try to run bun directly to see the error
    Write-Host ""
    Write-Host "   Intentando ejecutar bun directamente..." -ForegroundColor Gray
    Set-Location $INSTALL_DIR
    $process = Start-Process -FilePath $bunDest -ArgumentList $serverJs -PassThru -NoNewWindow -Wait -RedirectStandardError "$env:TEMP\bun-error.txt"
    if (Test-Path "$env:TEMP\bun-error.txt") {
        $bunError = Get-Content "$env:TEMP\bun-error.txt" -Raw
        if ($bunError) {
            Write-Host "   Error de Bun:" -ForegroundColor Red
            Write-Host "   $bunError" -ForegroundColor Red
        }
        Remove-Item "$env:TEMP\bun-error.txt" -ErrorAction SilentlyContinue
    }
    exit 1
}

# ============================================================
# VERIFY
# ============================================================
Write-Host ""
Write-Host "🔍 Verificando..." -ForegroundColor Yellow
$service = Get-Service -Name $SERVICE_NAME
if ($service.Status -eq 'Running') {
    $NewVersion = Get-InstalledVersion

    try {
        $response = Invoke-RestMethod -Uri "https://localhost:20936/health" -Method Get -SkipCertificateCheck
        Write-Host "✅ Servicio funcionando (HTTPS)" -ForegroundColor Green
        Write-Host "   🔒 Certificados SSL configurados" -ForegroundColor Gray
    } catch {
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:20936/health" -Method Get
            Write-Host "✅ Servicio funcionando (HTTP)" -ForegroundColor Green
            Write-Host "   ⚠️  Sin HTTPS" -ForegroundColor Yellow
        } catch {
            Write-Host "⚠️  No se pudo verificar el servicio" -ForegroundColor Yellow
        }
    }

    if ($IsUpdate) {
        Write-Host "   📦 Versión anterior: $CurrentVersion" -ForegroundColor Gray
        Write-Host "   📦 Versión nueva: $NewVersion" -ForegroundColor Gray
    } else {
        Write-Host "   📦 Versión: $NewVersion" -ForegroundColor Gray
    }
} else {
    Write-Host "❌ El servicio no se inició correctamente" -ForegroundColor Red
    Write-Host "Estado: $($service.Status)" -ForegroundColor Yellow

    if ($IsUpdate -and $BACKUP_DIR) {
        Write-Host "🔄 Restaurando backup..." -ForegroundColor Yellow
        # Remove service using nssm if available
        if (Test-Path $nssmPath) {
            try { & $nssmPath stop $SERVICE_NAME 2>&1 | Out-Null } catch {}
            try { & $nssmPath remove $SERVICE_NAME confirm 2>&1 | Out-Null } catch {}
        } else {
            Stop-Service -Name $SERVICE_NAME -Force -ErrorAction SilentlyContinue
            try { & "$env:SystemRoot\System32\sc.exe" delete $SERVICE_NAME 2>&1 | Out-Null } catch {}
        }
        Remove-Item -Path $INSTALL_DIR -Recurse -Force
        Copy-Item -Path $BACKUP_DIR -Destination $INSTALL_DIR -Recurse -Force
        Write-Host "✅ Backup restaurado" -ForegroundColor Green
    }
    exit 1
}

# Cleanup
Remove-Item -Path $TEMP_DIR -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "✅ ¡Completado!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Comandos útiles:" -ForegroundColor Yellow
Write-Host "   Get-Service ThermalPrintService"
Write-Host "   Restart-Service ThermalPrintService"
Write-Host ""
Write-Host "🌐 URL: https://localhost:20936" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
