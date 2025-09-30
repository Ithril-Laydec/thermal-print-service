# 📋 GUÍA RÁPIDA - Servicio ESC/POS Directo

## 1️⃣ Instalación

```bash
cd thermal-print-service
bun install

# DAR PERMISOS (obligatorio)
sudo chmod 666 /dev/usb/lp0
```

## 2️⃣ Ejecutar servicio

```bash
bun dev   # Con auto-reload
# o
bun start     # Normal
```

## 3️⃣ Desde el Frontend (Vue)

```javascript
// Comandos ESC/POS
const ESC = '\x1B';
const GS = '\x1D';

// Tamaños
const SIZE_3X = GS + '!' + '\x22';  // Triple para referencias
const SIZE_NORMAL = GS + '!' + '\x00';

// Crear ticket
let ticket = '';

// Referencia del albarán en 3x3
ticket += SIZE_3X;
ticket += 'ALB-2024-001\n';
ticket += SIZE_NORMAL;

ticket += 'Cliente: José García\n';
ticket += 'Total: 125.50€\n';

// Enviar al servicio
await fetch('http://localhost:20936/print/ticket', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: ticket })
});
```

## 4️⃣ Probar

```bash
bun test  # Imprime albarán de ejemplo
```

## 📊 Tamaños disponibles

| Comando | Tamaño | Uso |
|---------|--------|-----|
| `\x1D!\x00` | 1x1 | Normal |
| `\x1D!\x11` | 2x2 | Subtítulos |
| `\x1D!\x22` | 3x3 | **Referencias** |
| `\x1D!\x33` | 4x4 | Totales |
| `\x1D!\x77` | 8x8 | Máximo |

## ✅ Funcionan correctamente

- Euro: €
- Acentos: á é í ó ú
- Eñe: ñ Ñ
- Signos: ¡ ¿

## 🔧 El servicio automáticamente

1. Añade reset inicial (`ESC @`)
2. Configura CP858 para caracteres especiales
3. Añade corte de papel al final
4. Detecta el dispositivo USB disponible

## 📁 Archivos clave

- `src/services/RawEscposService.js` - Servicio de impresión
- `src/controllers/printController.js` - Endpoint `/print/ticket`
- `ejemplo-albaran-vue.js` - Ejemplo completo para Vue
- `test-simple.js` - Test de albarán con referencia 3x3