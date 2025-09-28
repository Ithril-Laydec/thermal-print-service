#!/bin/bash

echo "🔧 Reparación rápida de configuración CUPS"
echo "=========================================="

echo "🗑️  Eliminando configuración PostScript incorrecta..."
sudo lpadmin -x ALBARAN 2>/dev/null || true
sudo lpadmin -x Albaranes 2>/dev/null || true

echo "🖨️  Configurando impresoras como RAW para ESC/POS..."

# Configurar ALBARAN como RAW
sudo lpadmin -p ALBARAN -v usb://Unknown/Printer -m raw -E
sudo lpoptions -p ALBARAN -o raw
sudo cupsenable ALBARAN
sudo cupsaccept ALBARAN

# Configurar Albaranes como RAW
sudo lpadmin -p Albaranes -v usb://Unknown/Printer -m raw -E
sudo lpoptions -p Albaranes -o raw
sudo cupsenable Albaranes
sudo cupsaccept Albaranes

# Configurar como predeterminada
sudo lpadmin -d Albaranes

echo "🔄 Reiniciando CUPS..."
sudo systemctl restart cups

echo "✅ Reparación completada!"
echo "📋 Verifica configuración:"
echo "   lpstat -p"
echo "   lpoptions -p Albaranes"

echo ""
echo "🎯 Ahora reinicia tu servicio: bun start"