#!/bin/bash

# Script inteligente que detecta si debe instalar o actualizar
# el servicio de impresión térmica automáticamente

set -e

echo "🖨️  Gestor Inteligente del Servicio de Impresión Térmica"
echo "=========================================================="
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verificar sistema operativo
if [[ ! -f /etc/debian_version ]]; then
  echo -e "${RED}❌ Este script es solo para Ubuntu/Debian${NC}"
  exit 1
fi

# No ejecutar como root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}❌ No ejecutes este script como root. Usa tu usuario normal.${NC}"
   exit 1
fi

# Variables
INSTALL_DIR="/opt/thermal-print-service"
LOCAL_DIR="$HOME/thermal-print-service"
SERVICE_FILE="/etc/systemd/system/thermal-print.service"
GITHUB_REPO="https://github.com/Ithril-Laydec/thermal-print-service"
SERVICE_RUNNING=false
SERVICE_INSTALLED=false
INSTALLATION_TYPE=""
CURRENT_VERSION=""
LATEST_VERSION=""

echo "🔍 Analizando estado del servicio..."
echo ""

# Función para obtener versión instalada
get_installed_version() {
  # Intentar obtener versión del servicio en ejecución
  if curl -s http://localhost:20936/version 2>/dev/null | grep -o '"version":"[^"]*"' | cut -d'"' -f4; then
    return 0
  fi

  # Si no está corriendo, buscar en archivos locales
  if [ -f "$INSTALL_DIR/package.json" ]; then
    grep -o '"version": "[^"]*"' "$INSTALL_DIR/package.json" | cut -d'"' -f4
    return 0
  fi

  if [ -f "$LOCAL_DIR/package.json" ]; then
    grep -o '"version": "[^"]*"' "$LOCAL_DIR/package.json" | cut -d'"' -f4
    return 0
  fi

  echo "desconocida"
  return 1
}

# Verificar si el servicio está corriendo
if curl -s http://localhost:20936/health > /dev/null 2>&1; then
  SERVICE_RUNNING=true
  CURRENT_VERSION=$(get_installed_version)
  echo -e "${GREEN}✅ Servicio detectado y funcionando${NC}"
  echo "   Versión actual: $CURRENT_VERSION"
fi

# Verificar instalación del sistema
if [ -d "$INSTALL_DIR" ]; then
  SERVICE_INSTALLED=true
  INSTALLATION_TYPE="system"
  if [ "$CURRENT_VERSION" = "" ] || [ "$CURRENT_VERSION" = "desconocida" ]; then
    CURRENT_VERSION=$(get_installed_version)
  fi
  echo -e "${BLUE}📦 Instalación del sistema detectada en $INSTALL_DIR${NC}"
fi

# Verificar instalación local
if [ -d "$LOCAL_DIR" ] && [ "$INSTALLATION_TYPE" = "" ]; then
  SERVICE_INSTALLED=true
  INSTALLATION_TYPE="local"
  if [ "$CURRENT_VERSION" = "" ] || [ "$CURRENT_VERSION" = "desconocida" ]; then
    CURRENT_VERSION=$(get_installed_version)
  fi
  echo -e "${BLUE}📦 Instalación local detectada en $LOCAL_DIR${NC}"
fi

# Verificar servicio systemd
if systemctl list-units --full -all | grep -q "thermal-print" 2>/dev/null; then
  SERVICE_INSTALLED=true
  if [ "$INSTALLATION_TYPE" = "" ]; then
    INSTALLATION_TYPE="systemd"
  fi
  echo -e "${BLUE}🔧 Servicio systemd detectado${NC}"
fi

echo ""
echo "=========================================="

# Decidir acción basada en el estado
if [ "$SERVICE_INSTALLED" = false ]; then
  echo -e "${YELLOW}📦 INSTALACIÓN NUEVA REQUERIDA${NC}"
  echo ""
  echo "El servicio no está instalado. Se procederá con la instalación completa."
  ACTION="install"
else
  echo -e "${GREEN}🔄 ACTUALIZACIÓN DISPONIBLE${NC}"
  echo ""
  echo "El servicio ya está instalado. Se verificarán actualizaciones."
  ACTION="update"
fi

echo ""
# Usar /dev/tty para leer del terminal real, no del pipe
read -p "¿Deseas continuar? (s/n) " -n 1 -r < /dev/tty
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
  echo "Operación cancelada"
  exit 0
fi

echo ""

# Ejecutar la acción apropiada
if [ "$ACTION" = "install" ]; then
  echo "📥 Descargando instalador..."

  # Descargar y ejecutar el instalador
  curl -fsSL ${GITHUB_REPO}/raw/master/installers/install-ubuntu.sh -o /tmp/install-service.sh

  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error descargando el instalador${NC}"
    exit 1
  fi

  echo -e "${GREEN}✅ Descarga completada${NC}"
  echo ""
  echo "🚀 Ejecutando instalación..."
  echo ""

  chmod +x /tmp/install-service.sh
  /tmp/install-service.sh

  rm -f /tmp/install-service.sh

else
  echo "📥 Descargando actualizador..."

  # Primero verificar si hay actualizaciones disponibles
  echo "🔍 Verificando versión más reciente..."
  LATEST_VERSION=$(curl -s https://api.github.com/repos/Ithril-Laydec/thermal-print-service/releases/latest | grep '"tag_name"' | cut -d'"' -f4 || echo "v1.0.0")
  LATEST_VERSION=${LATEST_VERSION#v}  # Quitar la 'v' si existe

  echo "   Versión actual: $CURRENT_VERSION"
  echo "   Última versión: $LATEST_VERSION"

  if [ "$CURRENT_VERSION" = "$LATEST_VERSION" ]; then
    echo ""
    echo -e "${GREEN}✅ Ya tienes la última versión instalada${NC}"
    echo ""

    # Verificar si el servicio está corriendo
    if [ "$SERVICE_RUNNING" = false ]; then
      echo -e "${YELLOW}⚠️  El servicio no está corriendo${NC}"
      echo ""
      read -p "¿Deseas iniciar el servicio? (s/n) " -n 1 -r < /dev/tty
      echo
      if [[ $REPLY =~ ^[Ss]$ ]]; then
        if [ "$INSTALLATION_TYPE" = "system" ] || [ "$INSTALLATION_TYPE" = "systemd" ]; then
          echo "Iniciando servicio systemd..."
          sudo systemctl start thermal-print
          sudo systemctl status thermal-print --no-pager
        else
          echo "Para iniciar el servicio localmente, ejecuta:"
          echo "  cd $LOCAL_DIR && bun start"
        fi
      fi
    fi
    exit 0
  fi

  # Descargar y ejecutar el actualizador
  curl -fsSL ${GITHUB_REPO}/raw/master/installers/update-service.sh -o /tmp/update-service.sh

  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error descargando el actualizador${NC}"
    exit 1
  fi

  echo -e "${GREEN}✅ Descarga completada${NC}"
  echo ""
  echo "🚀 Ejecutando actualización..."
  echo ""

  chmod +x /tmp/update-service.sh

  # Si la instalación es local pero el actualizador espera /opt, adaptar
  if [ "$INSTALLATION_TYPE" = "local" ] && [ ! -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}📝 Nota: Tienes una instalación local.${NC}"
    echo "   El actualizador intentará migrar a una instalación del sistema."
    echo ""
  fi

  /tmp/update-service.sh

  rm -f /tmp/update-service.sh
fi

echo ""
echo -e "${GREEN}✨ Proceso completado exitosamente${NC}"
echo ""

# Verificar estado final
echo "🔍 Verificando estado final del servicio..."
if curl -s http://localhost:20936/health > /dev/null 2>&1; then
  FINAL_VERSION=$(curl -s http://localhost:20936/version 2>/dev/null | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || echo "desconocida")
  echo -e "${GREEN}✅ Servicio funcionando correctamente${NC}"
  echo "   Versión instalada: $FINAL_VERSION"
  echo "   URL: http://localhost:20936"
else
  echo -e "${YELLOW}⚠️  El servicio no está respondiendo${NC}"
  echo ""
  echo "Intenta iniciarlo manualmente:"
  if [ -d "$INSTALL_DIR" ]; then
    echo "  sudo systemctl start thermal-print"
  else
    echo "  cd ~/thermal-print-service && bun start"
  fi
fi

echo ""
echo "📖 Para más información, visita:"
echo "   $GITHUB_REPO"
echo ""
echo "¡Gracias por usar el servicio de impresión térmica!"