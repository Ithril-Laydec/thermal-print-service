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

    # Remove existing service (try WinSW first, then NSSM, then sc.exe as fallback)
    Write-Host ""
    Write-Host "🗑️  Eliminando servicio anterior..." -ForegroundColor Yellow
    $existingWinSW = Join-Path $INSTALL_DIR "ThermalPrintService.exe"
    $existingNssm = Join-Path $INSTALL_DIR "nssm.exe"
    if (Test-Path $existingWinSW) {
        try { & $existingWinSW stop 2>&1 | Out-Null } catch {}
        try { & $existingWinSW uninstall 2>&1 | Out-Null } catch {}
    } elseif (Test-Path $existingNssm) {
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

# Use cmd /c to completely bypass PowerShell stderr handling
# PowerShell treats ANY stderr output as error which breaks bun's progress messages
& $env:ComSpec /c "bun install --production"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error instalando dependencias" -ForegroundColor Red
    if ($IsUpdate -and $BACKUP_DIR) {
        Write-Host "🔄 Restaurando backup..." -ForegroundColor Yellow
        Remove-Item -Path $INSTALL_DIR -Recurse -Force
        Copy-Item -Path $BACKUP_DIR -Destination $INSTALL_DIR -Recurse -Force
    }
    exit 1
}

# ============================================================
# SYSTEM OPTIMIZATIONS (prevent cold-start issues)
# ============================================================
Write-Host ""
Write-Host "⚡ Configurando optimizaciones del sistema..." -ForegroundColor Yellow

# 1. Disable USB Selective Suspend (prevents USB printers from sleeping)
try {
    # Active power scheme
    $activeScheme = (powercfg /getactivescheme) -replace '.*:\s*(\S+)\s.*', '$1'
    # USB selective suspend: SubGroup 2a737441... Setting 48e6b7a6...
    # Value 0 = Disabled, 1 = Enabled
    powercfg /setacvalueindex $activeScheme 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0
    powercfg /setdcvalueindex $activeScheme 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0
    powercfg /setactive $activeScheme
    Write-Host "   ✅ USB Selective Suspend desactivado" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  No se pudo desactivar USB Selective Suspend" -ForegroundColor Yellow
}

# 2. Ensure Print Spooler is set to Automatic (not Delayed or Manual)
try {
    $spooler = Get-Service -Name Spooler -ErrorAction Stop
    if ($spooler.StartType -ne 'Automatic') {
        Set-Service -Name Spooler -StartupType Automatic
        Write-Host "   ✅ Print Spooler configurado como Automático" -ForegroundColor Green
    } else {
        Write-Host "   ✅ Print Spooler ya es Automático" -ForegroundColor Green
    }
    if ($spooler.Status -ne 'Running') {
        Start-Service -Name Spooler
        Write-Host "   ✅ Print Spooler iniciado" -ForegroundColor Green
    }
} catch {
    Write-Host "   ⚠️  No se pudo configurar Print Spooler: $_" -ForegroundColor Yellow
}

# 3. Disable Windows memory compression for service processes (prevents page-out)
try {
    # Set ThermalPrintService to not be trimmed from working set
    $regPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management"
    $currentValue = Get-ItemProperty -Path $regPath -Name "DisablePagingExecutive" -ErrorAction SilentlyContinue
    if (-not $currentValue -or $currentValue.DisablePagingExecutive -ne 1) {
        Set-ItemProperty -Path $regPath -Name "DisablePagingExecutive" -Value 1 -Type DWord
        Write-Host "   ✅ Paginación de ejecutables del kernel desactivada" -ForegroundColor Green
    } else {
        Write-Host "   ✅ Paginación de ejecutables ya desactivada" -ForegroundColor Green
    }
} catch {
    Write-Host "   ⚠️  No se pudo configurar paginación: $_" -ForegroundColor Yellow
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
# INSTALL WinSW (service wrapper) - bundled in repo
# ============================================================
Write-Host ""
Write-Host "📦 Instalando WinSW (service wrapper)..." -ForegroundColor Yellow
$winswPath = Join-Path $INSTALL_DIR "ThermalPrintService.exe"
$winswXml = Join-Path $INSTALL_DIR "ThermalPrintService.xml"

# Copy WinSW executable (renamed to service name)
$bundledWinSW = Join-Path $INSTALL_DIR "installers\bin\WinSW.exe"
$bundledXml = Join-Path $INSTALL_DIR "installers\bin\ThermalPrintService.xml"

if (Test-Path $bundledWinSW) {
    Copy-Item -Path $bundledWinSW -Destination $winswPath -Force
    Copy-Item -Path $bundledXml -Destination $winswXml -Force
    # Copy RawPrint.exe for native printer access
    $bundledRawPrint = Join-Path $INSTALL_DIR "installers\bin\RawPrint.exe"
    if (Test-Path $bundledRawPrint) {
        Copy-Item -Path $bundledRawPrint -Destination (Join-Path $INSTALL_DIR "RawPrint.exe") -Force
    }
    Write-Host "✅ WinSW instalado" -ForegroundColor Green
} else {
    Write-Host "❌ WinSW no encontrado en el paquete" -ForegroundColor Red
    Write-Host "   Esperado en: $bundledWinSW" -ForegroundColor Gray
    exit 1
}

# ============================================================
# CONFIGURE WINDOWS SERVICE (using WinSW)
# ============================================================
Write-Host ""
Write-Host "🔧 Configurando servicio de Windows..." -ForegroundColor Yellow

# Install service with WinSW
try {
    & $winswPath install 2>&1 | Out-Null
    Write-Host "✅ Servicio de Windows configurado" -ForegroundColor Green
} catch {
    Write-Host "❌ Error configurando servicio: $_" -ForegroundColor Red
    exit 1
}

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
        # Remove service using WinSW if available
        if (Test-Path $winswPath) {
            try { & $winswPath stop 2>&1 | Out-Null } catch {}
            try { & $winswPath uninstall 2>&1 | Out-Null } catch {}
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
