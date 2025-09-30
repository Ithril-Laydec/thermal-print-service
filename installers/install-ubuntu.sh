#!/bin/bash

set -e

echo "🖨️  Instalador del Servicio de Impresión Térmica - Ubuntu/Debian"
echo "================================================================="
echo ""

if [[ ! -f /etc/debian_version ]]; then
  echo "❌ Este script es solo para Ubuntu/Debian"
  exit 1
fi

if [[ $EUID -eq 0 ]]; then
   echo "❌ No ejecutes este script como root. Usa tu usuario normal."
   exit 1
fi

INSTALL_DIR="/opt/thermal-print-service"
SERVICE_FILE="/etc/systemd/system/thermal-print.service"
GITHUB_REPO="https://github.com/Ithril-Laydec/thermal-print-service.git"

echo "📋 Configuración:"
echo "   Directorio: $INSTALL_DIR"
echo "   Usuario: $USER"
echo "   Repositorio: $GITHUB_REPO"
echo ""

read -p "¿Continuar con la instalación? (s/n) " -n 1 -r < /dev/tty
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "Instalación cancelada"
    exit 0
fi

echo ""
echo "🔍 Verificando Bun..."
if ! command -v bun &> /dev/null; then
    echo "❌ Bun no encontrado. Instalando..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"

    # Crear symlink para systemd
    sudo ln -sf "$HOME/.bun/bin/bun" /usr/local/bin/bun
    echo "✅ Bun instalado"
else
    echo "✅ Bun ya está instalado ($(bun --version))"
    # Asegurar que existe el symlink
    if [ ! -f /usr/local/bin/bun ]; then
        BUN_PATH=$(which bun)
        sudo ln -sf "$BUN_PATH" /usr/local/bin/bun
    fi
fi

echo ""
echo "🔍 Verificando CUPS..."
if ! command -v lpstat &> /dev/null; then
    echo "📦 Instalando CUPS..."
    sudo apt update
    sudo apt install -y cups cups-client cups-bsd lpr
    echo "✅ CUPS instalado"
else
    echo "✅ CUPS ya está instalado"
fi

echo ""
echo "🔒 Configurando HTTPS con mkcert..."
if ! command -v mkcert &> /dev/null; then
    echo "📦 Instalando mkcert..."
    # Instalar libnss3-tools (requerido)
    sudo apt install -y libnss3-tools wget

    # Descargar e instalar mkcert
    MKCERT_VERSION="v1.4.4"
    MKCERT_URL="https://github.com/FiloSottile/mkcert/releases/download/${MKCERT_VERSION}/mkcert-${MKCERT_VERSION}-linux-amd64"

    wget -q "$MKCERT_URL" -O /tmp/mkcert
    chmod +x /tmp/mkcert
    sudo mv /tmp/mkcert /usr/local/bin/mkcert

    echo "✅ mkcert instalado"
else
    echo "✅ mkcert ya está instalado"
fi

echo ""
echo "🔐 Instalando Certificate Authority local..."
mkcert -install
echo "✅ CA local instalada - ¡Sin warnings de certificados en el navegador!"

echo ""
echo "👥 Configurando permisos de usuario..."
sudo usermod -a -G lp $USER
echo "✅ Usuario añadido al grupo lp"

echo ""
echo "🔍 Verificando git..."
if ! command -v git &> /dev/null; then
    echo "📦 Instalando git..."
    sudo apt update
    sudo apt install -y git
    echo "✅ Git instalado"
else
    echo "✅ Git ya está instalado"
fi

echo ""
echo "📥 Descargando servicio de impresión..."
TEMP_DIR=$(mktemp -d)
cd $TEMP_DIR

# Clonar el repositorio
git clone --depth 1 $GITHUB_REPO thermal-print-service
if [ $? -ne 0 ]; then
    echo "❌ Error descargando el repositorio"
    exit 1
fi

echo ""
echo "📦 Instalando en $INSTALL_DIR..."
sudo mkdir -p $INSTALL_DIR

# Copiar archivos al directorio de instalación
sudo cp -r thermal-print-service/* $INSTALL_DIR/

sudo chown -R $USER:$USER $INSTALL_DIR

echo ""
echo "📦 Instalando dependencias..."
cd $INSTALL_DIR
bun install --production

echo ""
echo "🔒 Generando certificados SSL para localhost..."
cd $INSTALL_DIR
mkcert localhost 127.0.0.1 ::1
echo "✅ Certificados SSL generados"

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

echo "✅ Archivo de servicio creado"

echo ""
echo "🚀 Habilitando e iniciando servicio..."
sudo systemctl daemon-reload
sudo systemctl enable thermal-print.service
sudo systemctl start thermal-print.service

echo ""
echo "⏳ Esperando que el servicio se inicie..."
sleep 3

echo ""
echo "🔍 Verificando estado del servicio..."
if sudo systemctl is-active --quiet thermal-print.service; then
    echo "✅ Servicio iniciado correctamente"

    VERSION=$(curl -s http://localhost:20936/version 2>/dev/null | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
    if [[ -n "$VERSION" ]]; then
        echo "📦 Versión instalada: $VERSION"
    fi
else
    echo "⚠️  El servicio no se inició correctamente"
    echo "Logs:"
    sudo journalctl -u thermal-print.service -n 20 --no-pager
fi

cd ~
rm -rf $TEMP_DIR

echo ""
echo "================================================================="
echo "✅ ¡Instalación completada!"
echo ""
echo "📋 Comandos útiles:"
echo "   sudo systemctl status thermal-print   # Ver estado"
echo "   sudo systemctl restart thermal-print  # Reiniciar"
echo "   sudo systemctl stop thermal-print     # Detener"
echo "   sudo journalctl -u thermal-print -f   # Ver logs en tiempo real"
echo ""
echo "🌐 El servicio está disponible en: https://localhost:20936"
echo "🔒 Con certificados SSL - ¡Sin warnings en el navegador!"
echo ""
echo "🎯 Endpoints:"
echo "   GET  https://localhost:20936/health"
echo "   POST https://localhost:20936/print"
echo ""
echo "💡 El servicio se iniciará automáticamente al arrancar el sistema"
echo "================================================================="