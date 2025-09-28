# 🚀 Instalación Ultra-Automática - 1 Comando

## ⚡ TODO EN UNO:

```bash
cd thermal-print-service
npm install
bun start
```

**¡Y listo!** El servicio automáticamente:
- ✅ Detecta tu sistema operativo
- ✅ Instala drivers CUPS (Linux) o genéricos (Windows)
- ✅ Configura impresoras "ALBARAN" y "Albaranes"
- ✅ Detecta tu impresora USB
- ✅ Inicia el servidor

## 📋 Prerequisitos únicos:
- Conecta tu impresora aqprox appPOS80AM por USB
- Enciéndela

**Verás esto si funciona:**
```
🚀 Iniciando servicio de impresión térmica...
==================================================
🔧 Verificando y configurando drivers automáticamente...
🔍 Verificando drivers de impresión térmica...
🔍 Verificando configuración actual de impresora...
⚠️  Impresora configurada incorrectamente como PostScript/HP
🔧 Reconfigurando automáticamente a RAW para ESC/POS...
🗑️  Eliminando configuración PostScript incorrecta...
🖨️  Configurando impresoras como RAW para ESC/POS...
🔄 Reiniciando CUPS para aplicar cambios...
✅ Configuración CUPS corregida automáticamente
✅ Drivers ya configurados correctamente
🔌 Verificando conexión de impresora...
✅ Impresora USB detectada

🖨️  Iniciando servidor HTTP...
🔧 Configurando impresora térmica...
🧪 Probando: Albaranes (RAW) (printer:Albaranes)
✅ Impresora configurada exitosamente: Albaranes (RAW)

✅ Servicio de impresión térmica LISTO
📡 Servidor ejecutándose en http://localhost:20936
🎉 ¡Todo listo! Usa tu aplicación Vue normalmente
==================================================
```

**¡CERO configuración manual!**
- ✅ Corrige automáticamente PostScript → RAW
- ✅ Usa el método más rápido primero (lpr)
- ✅ Convierte caracteres especiales: € → EUR, á → a, ñ → n

## ⚡ Desde tu aplicación Vue
```javascript
// En tu TicketPrintDialog.vue - YA ESTÁ INTEGRADO
// Solo selecciona "Térmica" y haz clic en "Imprimir"
// ¡Ya funciona automáticamente!
```

## ✅ ¡MVP TERMINADO!

Si ves el mensaje "✅ Servicio de impresión térmica LISTO", ¡ya puedes imprimir!

## ❌ Solo si hay problemas (muy raro):

### El servicio no arranca
- Edita `config.js` y cambia 20936 por otro puerto

### Impresora no detectada
1. Verifica que esté conectada por USB y encendida
2. Reinicia el servicio: `Ctrl+C` y `bun start`

**Nota**: Cualquier problema de configuración CUPS se corrige automáticamente

## 🔧 Comandos útiles (opcionales):
```bash
bun start           # Iniciar servicio (TODO AUTOMÁTICO)
npm run test-print  # Probar impresión sin Vue
npm run check       # Verificar estado manualmente
```

## 🎯 Resumen:
1. Conecta impresora USB
2. `cd thermal-print-service && npm install && bun start`
3. Usa tu aplicación Vue

**¡3 pasos y funciona en cualquier OS!**