#!/bin/bash

# Thermal Print Service - Unified Installer/Updater for Ubuntu/Debian
# Automatically detects whether to install or update

set -e

echo "🖨️  Servicio de Impresión Térmica - Ubuntu/Debian"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Verify OS
if [[ ! -f /etc/debian_version ]]; then
  echo -e "${RED}❌ Este script es solo para Ubuntu/Debian${NC}"
  exit 1
fi

# Don't run as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}❌ No ejecutes este script como root. Usa tu usuario normal.${NC}"
   exit 1
fi

# Variables
INSTALL_DIR="/opt/thermal-print-service"
SERVICE_FILE="/etc/systemd/system/thermal-print.service"
GITHUB_REPO="https://github.com/Ithril-Laydec/thermal-print-service.git"
SERVICE_RUNNING=false
IS_UPDATE=false
CURRENT_VERSION="desconocida"

# Function to get installed version
get_installed_version() {
  local version=""

  version=$(curl -sk https://localhost:20936/version 2>/dev/null | grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
  if [ -n "$version" ]; then
    echo "$version"
    return 0
  fi

  version=$(curl -s http://localhost:20936/version 2>/dev/null | grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
  if [ -n "$version" ]; then
    echo "$version"
    return 0
  fi

  if [ -f "$INSTALL_DIR/package.json" ]; then
    version=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$INSTALL_DIR/package.json" | cut -d'"' -f4)
    if [ -n "$version" ]; then
      echo "$version"
      return 0
    fi
  fi

  echo "desconocida"
}

# Detect current state
echo "🔍 Analizando estado del sistema..."

if curl -sk https://localhost:20936/health > /dev/null 2>&1; then
  SERVICE_RUNNING=true
  CURRENT_VERSION=$(get_installed_version)
  echo -e "${GREEN}✅ Servicio detectado (HTTPS) - v$CURRENT_VERSION${NC}"
elif curl -s http://localhost:20936/health > /dev/null 2>&1; then
  SERVICE_RUNNING=true
  CURRENT_VERSION=$(get_installed_version)
  echo -e "${GREEN}✅ Servicio detectado (HTTP) - v$CURRENT_VERSION${NC}"
fi

if [ -d "$INSTALL_DIR" ]; then
  IS_UPDATE=true
  if [ "$CURRENT_VERSION" = "desconocida" ]; then
    CURRENT_VERSION=$(get_installed_version)
  fi
  echo -e "${BLUE}📦 Instalación existente en $INSTALL_DIR${NC}"
fi

echo ""

# ============================================================
# INSTALL BUN
# ============================================================
echo "🔍 Verificando Bun..."
if ! command -v bun &> /dev/null; then
    echo "📦 Instalando Bun..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    sudo ln -sf "$HOME/.bun/bin/bun" /usr/local/bin/bun
    echo -e "${GREEN}✅ Bun instalado${NC}"
else
    echo -e "${GREEN}✅ Bun $(bun --version)${NC}"
    if [ ! -f /usr/local/bin/bun ]; then
        BUN_PATH=$(which bun)
        sudo ln -sf "$BUN_PATH" /usr/local/bin/bun
    fi
fi

# ============================================================
# INSTALL CUPS
# ============================================================
echo ""
echo "🔍 Verificando CUPS..."
if ! command -v lpstat &> /dev/null; then
    echo "📦 Instalando CUPS..."
    sudo apt update
    sudo apt install -y cups cups-client cups-bsd lpr
    echo -e "${GREEN}✅ CUPS instalado${NC}"
else
    echo -e "${GREEN}✅ CUPS instalado${NC}"
fi

# ============================================================
# INSTALL MKCERT
# ============================================================
echo ""
echo "🔒 Verificando mkcert..."
if ! command -v mkcert &> /dev/null; then
    echo "📦 Instalando mkcert..."
    sudo apt install -y libnss3-tools wget
    MKCERT_VERSION="v1.4.4"
    MKCERT_URL="https://github.com/FiloSottile/mkcert/releases/download/${MKCERT_VERSION}/mkcert-${MKCERT_VERSION}-linux-amd64"
    wget -q "$MKCERT_URL" -O /tmp/mkcert
    chmod +x /tmp/mkcert
    sudo mv /tmp/mkcert /usr/local/bin/mkcert
    echo -e "${GREEN}✅ mkcert instalado${NC}"
else
    echo -e "${GREEN}✅ mkcert instalado${NC}"
fi

echo ""
echo "🔐 Instalando Certificate Authority local..."
mkcert -install
echo -e "${GREEN}✅ CA local instalada${NC}"

# ============================================================
# INSTALL GIT
# ============================================================
echo ""
echo "🔍 Verificando git..."
if ! command -v git &> /dev/null; then
    echo "📦 Instalando git..."
    sudo apt update
    sudo apt install -y git
    echo -e "${GREEN}✅ Git instalado${NC}"
else
    echo -e "${GREEN}✅ Git instalado${NC}"
fi

# ============================================================
# USER PERMISSIONS
# ============================================================
echo ""
echo "👥 Configurando permisos..."
sudo usermod -a -G lp $USER
echo -e "${GREEN}✅ Usuario añadido al grupo lp${NC}"

# ============================================================
# UDEV RULES (printer symlinks)
# ============================================================
echo ""
echo "🔧 Configurando reglas udev para impresoras..."
UDEV_RULES_FILE="/etc/udev/rules.d/99-thermal-print.rules"

sudo tee $UDEV_RULES_FILE > /dev/null <<'UDEVRULES'
# Thermal Print Service - Printer symlinks
# EPSON LQ-590 (diplodocus) - matricial
SUBSYSTEM=="usbmisc", ATTRS{idVendor}=="04b8", ATTRS{idProduct}=="0005", SYMLINK+="printer/diplodocus", MODE="0666", GROUP="lp"
UDEVRULES

sudo udevadm control --reload-rules
sudo udevadm trigger
echo -e "${GREEN}✅ Reglas udev configuradas${NC}"

# Create symlink immediately if device is connected
if [ -e /dev/usb/lp0 ]; then
    VENDOR=$(cat /sys/class/usbmisc/lp0/device/uevent 2>/dev/null | grep PRODUCT | cut -d= -f2 | cut -d/ -f1)
    if [ "$VENDOR" = "4b8" ]; then
        sudo mkdir -p /dev/printer
        sudo ln -sf /dev/usb/lp0 /dev/printer/diplodocus
        sudo chmod 666 /dev/printer/diplodocus
        echo -e "${GREEN}✅ Symlink /dev/printer/diplodocus creado${NC}"
    fi
fi

# ============================================================
# BACKUP (if updating)
# ============================================================
BACKUP_DIR=""
if [ "$IS_UPDATE" = true ]; then
    echo ""
    echo "🛑 Deteniendo servicio..."
    sudo systemctl stop thermal-print.service 2>/dev/null || true

    echo ""
    echo "💾 Creando backup..."
    BACKUP_DIR="/tmp/thermal-print-backup-$(date +%Y%m%d-%H%M%S)"
    sudo cp -r $INSTALL_DIR $BACKUP_DIR
    echo -e "${GREEN}✅ Backup en $BACKUP_DIR${NC}"
fi

# ============================================================
# DOWNLOAD SERVICE
# ============================================================
echo ""
echo "📥 Descargando servicio..."
TEMP_DIR=$(mktemp -d)
cd $TEMP_DIR

git clone --depth 1 $GITHUB_REPO thermal-print-service
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error descargando el repositorio${NC}"
    if [ "$IS_UPDATE" = true ]; then
        echo "🔄 Restaurando backup..."
        sudo systemctl start thermal-print.service 2>/dev/null || true
    fi
    exit 1
fi

# ============================================================
# INSTALL FILES
# ============================================================
echo ""
echo "📦 Instalando en $INSTALL_DIR..."

if [ "$IS_UPDATE" = true ]; then
    # Preserve node_modules if exists
    if [ -d "$INSTALL_DIR/node_modules" ]; then
        sudo mv $INSTALL_DIR/node_modules /tmp/node_modules_backup
    fi
    sudo rm -rf $INSTALL_DIR/*
else
    sudo mkdir -p $INSTALL_DIR
fi

sudo cp -r thermal-print-service/* $INSTALL_DIR/

if [ -d "/tmp/node_modules_backup" ]; then
    sudo mv /tmp/node_modules_backup $INSTALL_DIR/node_modules
fi

sudo chown -R $USER:$USER $INSTALL_DIR

# ============================================================
# INSTALL DEPENDENCIES
# ============================================================
echo ""
echo "📦 Instalando dependencias..."
cd $INSTALL_DIR
rm -f package-lock.json bun.lockb
bun install --production

# ============================================================
# GENERATE SSL CERTIFICATES
# ============================================================
echo ""
echo "🔒 Generando certificados SSL..."
cd $INSTALL_DIR
if [ ! -f "localhost+2.pem" ] || [ ! -f "localhost+2-key.pem" ]; then
    mkcert localhost 127.0.0.1 ::1
    echo -e "${GREEN}✅ Certificados SSL generados${NC}"
else
    echo -e "${GREEN}✅ Certificados SSL existentes${NC}"
fi

# ============================================================
# CONFIGURE SYSTEMD
# ============================================================
echo ""
echo "🔧 Configurando servicio systemd..."
sudo tee $SERVICE_FILE > /dev/null <<EOF
[Unit]
Description=Thermal Print Service
Documentation=https://github.com/Ithril-Laydec/thermal-print-service
After=network.target cups.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/local/bin/bun $INSTALL_DIR/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=thermal-print

Environment=NODE_ENV=production
Environment=PORT=20936
Environment=HOST=localhost

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✅ Servicio systemd configurado${NC}"

# ============================================================
# START SERVICE
# ============================================================
echo ""
echo "🚀 Iniciando servicio..."
sudo systemctl daemon-reload
sudo systemctl enable thermal-print.service
sudo systemctl start thermal-print.service

echo ""
echo "⏳ Esperando inicio..."
sleep 3

# ============================================================
# VERIFY
# ============================================================
echo ""
echo "🔍 Verificando..."
if sudo systemctl is-active --quiet thermal-print.service; then
    NEW_VERSION=$(get_installed_version)

    if curl -sk https://localhost:20936/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Servicio funcionando (HTTPS)${NC}"
        echo "   🔒 Certificados SSL configurados"
    elif curl -s http://localhost:20936/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Servicio funcionando (HTTP)${NC}"
        echo "   ⚠️  Sin HTTPS"
    fi

    if [ "$IS_UPDATE" = true ]; then
        echo "   📦 Versión anterior: $CURRENT_VERSION"
        echo "   📦 Versión nueva: $NEW_VERSION"
    else
        echo "   📦 Versión: $NEW_VERSION"
    fi
else
    echo -e "${RED}❌ El servicio no se inició correctamente${NC}"
    sudo journalctl -u thermal-print.service -n 20 --no-pager

    if [ "$IS_UPDATE" = true ] && [ -n "$BACKUP_DIR" ]; then
        echo "🔄 Restaurando backup..."
        sudo rm -rf $INSTALL_DIR
        sudo cp -r $BACKUP_DIR $INSTALL_DIR
        sudo systemctl start thermal-print.service
        echo -e "${GREEN}✅ Backup restaurado${NC}"
    fi
    exit 1
fi

# Cleanup
cd ~
rm -rf $TEMP_DIR

echo ""
echo "=================================================="
echo -e "${GREEN}✅ ¡Completado!${NC}"
echo ""
echo "📋 Comandos útiles:"
echo "   sudo systemctl status thermal-print"
echo "   sudo systemctl restart thermal-print"
echo "   sudo journalctl -u thermal-print -f"
echo ""
echo "🌐 URL: https://localhost:20936"
echo "=================================================="
