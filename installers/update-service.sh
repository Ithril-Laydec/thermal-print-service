#!/bin/bash

set -e

echo "🔄 Actualizador del Servicio de Impresión Térmica - Ubuntu/Debian"
echo "=================================================================="
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
DOWNLOAD_URL="${THERMAL_SERVICE_URL:-https://github.com/Ithril-Laydec/thermal-print-service/archive/refs/tags/latest.tar.gz}"

if [[ ! -d "$INSTALL_DIR" ]]; then
    echo "❌ El servicio no está instalado en $INSTALL_DIR"
    echo "   Ejecuta install-ubuntu.sh primero"
    exit 1
fi

echo "🔍 Verificando versión actual..."
CURRENT_VERSION=$(curl -s http://localhost:20936/version 2>/dev/null | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || echo "desconocida")
echo "📦 Versión actual: $CURRENT_VERSION"

echo ""
read -p "¿Continuar con la actualización? (s/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "Actualización cancelada"
    exit 0
fi

echo ""
echo "🛑 Deteniendo servicio..."
sudo systemctl stop thermal-print.service

echo ""
echo "💾 Creando backup..."
BACKUP_DIR="/tmp/thermal-print-backup-$(date +%Y%m%d-%H%M%S)"
sudo cp -r $INSTALL_DIR $BACKUP_DIR
echo "✅ Backup creado en $BACKUP_DIR"

echo ""
echo "📥 Descargando nueva versión..."
TEMP_DIR=$(mktemp -d)
cd $TEMP_DIR

if [[ $DOWNLOAD_URL == http* ]]; then
    curl -L -o thermal-print-service.tar.gz "$DOWNLOAD_URL"
    tar -xzf thermal-print-service.tar.gz
    SERVICE_DIR=$(find . -maxdepth 1 -type d -name "thermal-print-service*" | head -n 1)
else
    echo "❌ URL de descarga no válida"
    echo "🔄 Restaurando backup..."
    sudo systemctl start thermal-print.service
    exit 1
fi

echo ""
echo "📦 Actualizando archivos..."
if [[ -d "$SERVICE_DIR" ]]; then
    sudo cp -r $SERVICE_DIR/* $INSTALL_DIR/
    sudo chown -R $USER:$USER $INSTALL_DIR
else
    echo "❌ Error: No se encontró el directorio del servicio"
    echo "🔄 Restaurando backup..."
    sudo rm -rf $INSTALL_DIR
    sudo cp -r $BACKUP_DIR $INSTALL_DIR
    sudo systemctl start thermal-print.service
    exit 1
fi

echo ""
echo "📦 Actualizando dependencias..."
cd $INSTALL_DIR
npm install --production

echo ""
echo "🚀 Reiniciando servicio..."
sudo systemctl start thermal-print.service

echo ""
echo "⏳ Esperando que el servicio se inicie..."
sleep 3

echo ""
echo "🔍 Verificando nueva versión..."
if sudo systemctl is-active --quiet thermal-print.service; then
    NEW_VERSION=$(curl -s http://localhost:20936/version 2>/dev/null | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || echo "desconocida")
    echo "✅ Servicio actualizado correctamente"
    echo "📦 Versión anterior: $CURRENT_VERSION"
    echo "📦 Versión nueva: $NEW_VERSION"

    if [[ "$CURRENT_VERSION" == "$NEW_VERSION" ]]; then
        echo "⚠️  Las versiones son iguales. Puede que no haya actualización disponible."
    fi
else
    echo "❌ El servicio no se inició correctamente"
    echo "🔄 Restaurando backup..."
    sudo systemctl stop thermal-print.service
    sudo rm -rf $INSTALL_DIR
    sudo cp -r $BACKUP_DIR $INSTALL_DIR
    sudo systemctl start thermal-print.service
    echo "✅ Backup restaurado"
    exit 1
fi

cd ~
rm -rf $TEMP_DIR

echo ""
echo "🗑️  Puedes eliminar el backup manualmente:"
echo "   sudo rm -rf $BACKUP_DIR"
echo ""
echo "=================================================================="
echo "✅ ¡Actualización completada!"
echo "=================================================================="