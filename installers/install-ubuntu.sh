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
echo "🔍 Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no encontrado. Instalando..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo "✅ Node.js instalado"
else
    echo "✅ Node.js ya está instalado ($(node --version))"
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
npm install --production

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
ExecStart=/usr/bin/node $INSTALL_DIR/server.js
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
echo "🌐 El servicio está disponible en: http://localhost:20936"
echo "🎯 Endpoints:"
echo "   GET  http://localhost:20936/health"
echo "   GET  http://localhost:20936/version"
echo "   POST http://localhost:20936/print/ticket"
echo ""
echo "💡 El servicio se iniciará automáticamente al arrancar el sistema"
echo "================================================================="