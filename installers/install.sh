#!/bin/bash

# Thermal Print Service - Unified Installer/Updater for Ubuntu/Debian
# Automatically detects whether to install or update
#
# MODES:
#   client (default)  -- local thermal printer, mkcert localhost cert
#   server            -- LAN server, HOST=0.0.0.0, masks CUPS, configures ufw
#   server + cert     -- same + issue Let's Encrypt cert via deSEC DNS-01
#
# USAGE:
#   curl -fsSL .../install.sh | bash                                            # client
#   curl -fsSL .../install.sh | bash -s -- --server                            # server
#   curl -fsSL .../install.sh | bash -s -- --server --domain print.example.com # server + existing cert
#   curl -fsSL .../install.sh | bash -s -- --server --issue-cert \             # server + issue cert
#       --domain print.example.com --dedyn-token <TOKEN>

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

# ============================================================
# PARSE FLAGS
# ============================================================
MODE="client"
DOMAIN=""
DEDYN_TOKEN=""
ISSUE_CERT=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server)
      MODE="server"
      shift
      ;;
    --issue-cert)
      ISSUE_CERT=true
      shift
      ;;
    --domain)
      DOMAIN="$2"
      shift 2
      ;;
    --dedyn-token)
      DEDYN_TOKEN="$2"
      shift 2
      ;;
    *)
      echo -e "${RED}❌ Flag desconocida: $1${NC}"
      echo "   Uso: bash -s -- [--server] [--issue-cert --domain <fqdn> --dedyn-token <token>]"
      exit 1
      ;;
  esac
done

# ============================================================
# VALIDATE FLAGS
# ============================================================
if [ "$ISSUE_CERT" = true ]; then
  if [ "$MODE" != "server" ]; then
    echo -e "${RED}❌ --issue-cert requiere --server${NC}"
    exit 1
  fi
  if [ -z "$DOMAIN" ]; then
    echo -e "${RED}❌ --issue-cert requiere --domain <fqdn>${NC}"
    exit 1
  fi
  if [ -z "$DEDYN_TOKEN" ]; then
    echo -e "${RED}❌ --issue-cert requiere --dedyn-token <token>${NC}"
    exit 1
  fi

  # Validate deSEC token BEFORE touching anything on the system
  echo "🔑 Validando token deSEC..."
  set +e
  DESEC_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Token $DEDYN_TOKEN" \
    https://desec.io/api/v1/domains/ 2>/dev/null)
  CURL_EXIT=$?
  set -e
  if [ $CURL_EXIT -ne 0 ]; then
    echo -e "${RED}❌ No se pudo contactar con deSEC (error de red, código curl: $CURL_EXIT)${NC}"
    echo "   Verifica la conexión a Internet antes de continuar."
    exit 1
  fi
  if [ "$DESEC_HTTP" != "200" ]; then
    echo -e "${RED}❌ Token deSEC inválido o mal escrito (HTTP $DESEC_HTTP)${NC}"
    echo "   Verifica que DEDYN_TOKEN sea correcto en https://desec.io"
    exit 1
  fi
  echo -e "${GREEN}✅ Token deSEC válido${NC}"
  echo ""
fi

# ============================================================
# EARLY CERT ISSUE (--issue-cert only)
# Issue the certificate BEFORE stopping the service / backup / replacing files.
# If --issue fails (DNS propagation, network, etc.) we exit cleanly without
# having touched the running system at all.
# --install-cert (copy cert to project dir + reloadcmd) runs later, once the
# project files are in place.
# ============================================================
if [ "$ISSUE_CERT" = true ]; then
  ACME_BIN="$HOME/.acme.sh/acme.sh"

  if [ ! -f "$ACME_BIN" ]; then
    echo "📦 Instalando acme.sh..."
    curl -fsSL https://get.acme.sh | bash -s email=acme@localhost
    # shellcheck source=/dev/null
    source "$HOME/.acme.sh/acme.sh.env" 2>/dev/null || true
    echo -e "${GREEN}✅ acme.sh instalado${NC}"
  else
    echo -e "${GREEN}✅ acme.sh ya instalado${NC}"
  fi

  echo "📜 Emitiendo certificado Let's Encrypt para $DOMAIN (DNS-01 / deSEC)..."
  echo "   ⏳ Esperando propagación DNS (~120 segundos)..."
  set +e
  DEDYN_TOKEN="$DEDYN_TOKEN" "$ACME_BIN" \
    --issue \
    --dns dns_desec \
    -d "$DOMAIN" \
    --server letsencrypt \
    --keylength ec-256 \
    --dnssleep 120
  ACME_ISSUE_RC=$?
  set -e
  if [ $ACME_ISSUE_RC -eq 0 ]; then
    echo -e "${GREEN}✅ Certificado emitido${NC}"
  elif [ $ACME_ISSUE_RC -eq 2 ]; then
    echo -e "${GREEN}✅ Certificado ya vigente, no es necesario renovar${NC}"
  else
    echo -e "${RED}❌ Error al emitir el certificado (acme.sh salió con código $ACME_ISSUE_RC)${NC}"
    exit 1
  fi
  echo ""
fi

# ============================================================
# SHOW MODE
# ============================================================
echo -e "${BLUE}ℹ️  Modo: $MODE${NC}"
if [ -n "$DOMAIN" ]; then
  echo -e "${BLUE}ℹ️  Dominio: $DOMAIN${NC}"
fi
if [ "$ISSUE_CERT" = true ]; then
  echo -e "${BLUE}ℹ️  Se emitirá certificado Let's Encrypt vía deSEC${NC}"
fi
echo ""

# Variables
INSTALL_DIR="/opt/thermal-print-service"
CERTS_DIR="$INSTALL_DIR/certs"
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
# INSTALL CURL (server mode: may not be present on clean install)
# ============================================================
if [ "$MODE" = "server" ]; then
  echo "🔍 Verificando curl..."
  if ! command -v curl &> /dev/null; then
    echo "📦 Instalando curl..."
    sudo apt update
    sudo apt install -y curl
    echo -e "${GREEN}✅ curl instalado${NC}"
  else
    echo -e "${GREEN}✅ curl instalado${NC}"
  fi
  echo ""
fi

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
# CUPS: mask in server mode, skip in client mode
# (client local no necesita CUPS; matricial/térmica van por usblp directo)
# ============================================================
echo ""
if [ "$MODE" = "server" ]; then
  echo "🔒 Enmascarando CUPS (servidor: matricial usa usblp directo)..."
  for svc in cups cups-browsed cups.socket cups.path; do
    sudo systemctl mask "$svc" 2>/dev/null || true
  done
  echo -e "${GREEN}✅ CUPS enmascarado${NC}"
else
  echo "ℹ️  Modo cliente: CUPS no necesario (usblp directo)"
fi

# ============================================================
# ENSURE usblp MODULE (server mode only)
# CUPS reclama la impresora matricial EPSON (04b8:0005) por libusb y
# desvincula usblp → desaparece /dev/usb/lp0. Con CUPS enmascarado
# y usblp cargado, /dev/printer/diplodocus queda estable.
# ============================================================
if [ "$MODE" = "server" ]; then
  echo ""
  echo "🔧 Asegurando módulo usblp..."
  if ! lsmod | grep -q "^usblp"; then
    sudo modprobe usblp 2>/dev/null || true
  fi
  USBLP_CONF="/etc/modules-load.d/usblp.conf"
  if [ ! -f "$USBLP_CONF" ] || ! grep -q "^usblp$" "$USBLP_CONF" 2>/dev/null; then
    echo "usblp" | sudo tee "$USBLP_CONF" > /dev/null
  fi
  echo -e "${GREEN}✅ Módulo usblp asegurado${NC}"
fi

# ============================================================
# INSTALL MKCERT (client mode only)
# ============================================================
if [ "$MODE" = "client" ]; then
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
fi

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
        sudo rm -rf /tmp/node_modules_backup
        sudo mv $INSTALL_DIR/node_modules /tmp/node_modules_backup
    fi
    # Preserve existing certs dir (Let's Encrypt certs)
    # Clean previous backup first to avoid nesting if a prior run crashed mid-flight
    if [ -d "$CERTS_DIR" ]; then
        sudo rm -rf /tmp/thermal-certs-backup
        sudo mv "$CERTS_DIR" /tmp/thermal-certs-backup
    fi
    sudo rm -rf $INSTALL_DIR/*
else
    sudo mkdir -p $INSTALL_DIR
fi

sudo cp -r thermal-print-service/* $INSTALL_DIR/

if [ -d "/tmp/node_modules_backup" ]; then
    sudo mv /tmp/node_modules_backup $INSTALL_DIR/node_modules
fi

# Restore certs dir if it was backed up
if [ -d "/tmp/thermal-certs-backup" ]; then
    sudo mv /tmp/thermal-certs-backup "$CERTS_DIR"
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
# SSL CERTIFICATES
# ============================================================
echo ""
echo "🔒 Configurando certificados SSL..."

if [ "$MODE" = "client" ]; then
  # Client mode: mkcert self-signed for localhost
  cd $INSTALL_DIR
  if [ ! -f "localhost+2.pem" ] || [ ! -f "localhost+2-key.pem" ]; then
      mkcert localhost 127.0.0.1 ::1
      echo -e "${GREEN}✅ Certificados SSL mkcert generados${NC}"
  else
      echo -e "${GREEN}✅ Certificados SSL mkcert existentes${NC}"
  fi
elif [ "$MODE" = "server" ] && [ "$ISSUE_CERT" = true ]; then
  # Server + issue-cert: cert was already issued in the EARLY CERT ISSUE phase above
  # (before stopping the service / backup / replacing files).
  # We only need to install it now that the project directory is in place.
  ACME_BIN="$HOME/.acme.sh/acme.sh"

  # Create certs directory
  mkdir -p "$CERTS_DIR"

  echo "📦 Instalando certificado en $CERTS_DIR/$DOMAIN..."
  "$ACME_BIN" --install-cert -d "$DOMAIN" --ecc \
    --key-file      "$CERTS_DIR/$DOMAIN.key" \
    --fullchain-file "$CERTS_DIR/$DOMAIN.pem" \
    --reloadcmd "sudo systemctl restart thermal-print"
  echo -e "${GREEN}✅ Certificado instalado (auto-renovación configurada)${NC}"
elif [ "$MODE" = "server" ] && [ -n "$DOMAIN" ]; then
  # Server + domain but no issue-cert: cert was issued previously
  if [ -f "$CERTS_DIR/$DOMAIN.pem" ] && [ -f "$CERTS_DIR/$DOMAIN.key" ]; then
    echo -e "${GREEN}✅ Certificado existente para $DOMAIN${NC}"
  else
    echo -e "${YELLOW}⚠️  No se encontró certificado en $CERTS_DIR/$DOMAIN.{pem,key}${NC}"
    echo "   Ejecuta con --issue-cert para emitir uno nuevo"
  fi
else
  # Server mode without domain: runs HTTP or uses cert already present
  echo -e "${YELLOW}ℹ️  Modo servidor sin dominio: sin cert HTTPS (HTTP o cert manual)${NC}"
fi

# ============================================================
# CONFIGURE SYSTEMD
# ============================================================
echo ""
echo "🔧 Configurando servicio systemd..."

# HOST depends on mode
if [ "$MODE" = "server" ]; then
  UNIT_HOST="0.0.0.0"
else
  UNIT_HOST="localhost"
fi

# After= dependency: cups.service not needed in either mode
# (client: usblp direct, no CUPS installed; server: CUPS is masked)
UNIT_AFTER="After=network.target"

# Cert env vars for unit (server + domain)
UNIT_CERT_ENV=""
if [ "$MODE" = "server" ] && [ -n "$DOMAIN" ]; then
  UNIT_CERT_ENV="Environment=CERT_FILE=$CERTS_DIR/$DOMAIN.pem
Environment=KEY_FILE=$CERTS_DIR/$DOMAIN.key"
fi

sudo tee $SERVICE_FILE > /dev/null <<EOF
[Unit]
Description=Thermal Print Service
Documentation=https://github.com/Ithril-Laydec/thermal-print-service
$UNIT_AFTER

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
Environment=HOST=$UNIT_HOST
$UNIT_CERT_ENV

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✅ Servicio systemd configurado (HOST=$UNIT_HOST)${NC}"

# ============================================================
# SUDOERS: allow service user to restart thermal-print without password
# Required for acme.sh reloadcmd ("sudo systemctl restart thermal-print")
# so certificate auto-renewal works without interactive sudo.
# ============================================================
if [ "$MODE" = "server" ]; then
  echo ""
  echo "🔧 Configurando sudoers para renovación desatendida de certificados..."
  SUDOERS_FILE="/etc/sudoers.d/thermal-print-reload"
  SYSTEMCTL_PATH=$(command -v systemctl)
  SUDOERS_LINE="$USER ALL=(ALL) NOPASSWD: $SYSTEMCTL_PATH restart thermal-print"

  echo "$SUDOERS_LINE" | sudo tee "$SUDOERS_FILE" > /dev/null
  sudo chmod 440 "$SUDOERS_FILE"

  if sudo visudo -cf "$SUDOERS_FILE" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Regla sudoers configurada ($SUDOERS_FILE)${NC}"
  else
    echo -e "${RED}❌ La regla sudoers no es válida; eliminando para no comprometer el sistema${NC}"
    sudo rm -f "$SUDOERS_FILE"
    echo "   Configura manualmente: $SUDOERS_LINE"
  fi
fi

# ============================================================
# FIREWALL (server mode only)
# Allow SSH before enabling ufw to avoid locking yourself out
# ============================================================
if [ "$MODE" = "server" ]; then
  echo ""
  echo "🔥 Configurando firewall (ufw)..."
  if command -v ufw &> /dev/null; then
    # Detect LAN subnet from the default route interface
    DEFAULT_IF=$(ip route 2>/dev/null | grep '^default' | awk '{print $5}' | head -1)
    LAN_SUBNET=""
    if [ -n "$DEFAULT_IF" ]; then
      LAN_SUBNET=$(ip route 2>/dev/null | grep "dev $DEFAULT_IF" | grep -v '^default' | awk '{print $1}' | head -1)
    fi

    # CRITICAL: allow SSH first, before enabling ufw
    # Detect actual sshd port — non-standard ports would be cut off by "ufw allow OpenSSH" (22)
    SSH_PORT=$(sudo sshd -T 2>/dev/null | awk '/^port /{print $2; exit}')
    if [ -z "$SSH_PORT" ]; then
      # Portable fallback: grep sshd from ss output, extract trailing port with grep -oE (no gawk extensions)
      SSH_PORT=$(ss -H -tlnp 2>/dev/null | grep 'sshd' | awk '{print $4}' | grep -oE '[0-9]+$' | head -1)
    fi
    SSH_PORT="${SSH_PORT:-22}"
    sudo ufw allow "$SSH_PORT/tcp"
    echo -e "${GREEN}✅ SSH permitido (puerto $SSH_PORT/tcp)${NC}"

    if [ -n "$LAN_SUBNET" ]; then
      sudo ufw allow from "$LAN_SUBNET" to any port 20936 proto tcp
      echo -e "${GREEN}✅ Puerto 20936 abierto para subred LAN: $LAN_SUBNET${NC}"
    else
      echo -e "${YELLOW}⚠️  No se detectó subred LAN; abre el puerto manualmente:${NC}"
      echo "   sudo ufw allow from <subred> to any port 20936 proto tcp"
    fi

    sudo ufw --force enable
    echo -e "${GREEN}✅ UFW habilitado${NC}"
  else
    echo -e "${YELLOW}⚠️  ufw no encontrado; instálalo o configura el firewall manualmente${NC}"
  fi
fi

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
echo -e "${GREEN}✅ ¡Completado! Modo: $MODE${NC}"
echo ""
echo "📋 Comandos útiles:"
echo "   sudo systemctl status thermal-print"
echo "   sudo systemctl restart thermal-print"
echo "   sudo journalctl -u thermal-print -f"
echo ""
if [ "$MODE" = "server" ] && [ -n "$DOMAIN" ]; then
  echo "🌐 URL: https://$DOMAIN:20936"
elif [ "$MODE" = "server" ]; then
  echo "🌐 URL (LAN): http://<ip-servidor>:20936"
else
  echo "🌐 URL: https://localhost:20936"
fi
echo "=================================================="
