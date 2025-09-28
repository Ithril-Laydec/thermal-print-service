#!/bin/bash

echo "🖨️  Instalador automático de drivers térmicos para Ubuntu"
echo "======================================================="

# Verificar si es Ubuntu/Debian
if [[ ! -f /etc/debian_version ]]; then
  echo "❌ Este script es solo para Ubuntu/Debian"
  exit 1
fi

# Verificar permisos de sudo
if [[ $EUID -eq 0 ]]; then
   echo "❌ No ejecutes este script como root. Usa sudo cuando sea necesario."
   exit 1
fi

echo "📦 Actualizando repositorios..."
sudo apt update

echo "🔧 Instalando CUPS y dependencias..."
sudo apt install -y cups cups-client cups-bsd lpr

echo "👥 Añadiendo usuario al grupo lp..."
sudo usermod -a -G lp $USER

echo "🔌 Detectando impresora aqprox appPOS80AM..."
lsusb | grep -i "printer\|pos\|thermal" || echo "⚠️  No se detectó impresora térmica por USB"

echo "🖨️  Configurando impresora térmica como 'ALBARAN'..."

# Crear configuración CUPS para impresora térmica
sudo lpadmin -p ALBARAN -v usb://Unknown/Printer -m raw -E
sudo cupsenable ALBARAN
sudo cupsaccept ALBARAN

# También crear alias 'Albaranes'
sudo lpadmin -p Albaranes -v usb://Unknown/Printer -m raw -E
sudo cupsenable Albaranes
sudo cupsaccept Albaranes

echo "🎯 Configurando como impresora predeterminada..."
sudo lpadmin -d ALBARAN

echo "🧪 Probando configuración..."
echo "Prueba de impresión $(date)" | lpr -P ALBARAN

echo "✅ Instalación completada!"
echo ""
echo "📋 Próximos pasos:"
echo "   1. Reinicia tu sesión para aplicar permisos: logout/login"
echo "   2. Conecta tu impresora aqprox appPOS80AM por USB"
echo "   3. Ejecuta: bun start"
echo "   4. Prueba desde la aplicación Vue"
echo ""
echo "🔍 Para verificar:"
echo "   lpstat -p         # Ver impresoras"
echo "   lsusb             # Ver dispositivos USB"
echo "   groups \$USER       # Verificar grupo 'lp'"