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
GITHUB_REPO="https://github.com/Ithril-Laydec/thermal-print-service.git"

if [[ ! -d "$INSTALL_DIR" ]]; then
    echo "❌ El servicio no está instalado en $INSTALL_DIR"
    echo "   Ejecuta install-ubuntu.sh primero"
    exit 1
fi

echo "🔍 Verificando versión actual..."
CURRENT_VERSION=$(curl -s http://localhost:20936/version 2>/dev/null | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || echo "desconocida")
echo "📦 Versión actual: $CURRENT_VERSION"

echo ""
read -p "¿Continuar con la actualización? (s/n) " -n 1 -r < /dev/tty
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

# Clonar la última versión del repositorio
git clone --depth 1 $GITHUB_REPO thermal-print-service
if [ $? -ne 0 ]; then
    echo "❌ Error descargando el repositorio"
    echo "🔄 Restaurando backup..."
    sudo systemctl start thermal-print.service
    exit 1
fi

echo ""
echo "📦 Actualizando archivos..."
# Limpiar directorio actual (excepto node_modules si existe)
if [ -d "$INSTALL_DIR/node_modules" ]; then
    sudo mv $INSTALL_DIR/node_modules /tmp/node_modules_backup
fi

sudo rm -rf $INSTALL_DIR/*

# Copiar nuevos archivos
sudo cp -r thermal-print-service/* $INSTALL_DIR/

# Restaurar node_modules si existía
if [ -d "/tmp/node_modules_backup" ]; then
    sudo mv /tmp/node_modules_backup $INSTALL_DIR/node_modules
fi

sudo chown -R $USER:$USER $INSTALL_DIR

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
echo "📦 Actualizando dependencias..."
cd $INSTALL_DIR
bun install --production

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