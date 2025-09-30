# ✅ SOLUCIÓN FINAL - ESC/POS Directo + CP858

## Servicio simplificado

El servicio ahora:
1. **Recibe texto con comandos ESC/POS** directamente del frontend
2. **Añade automáticamente** reset inicial y configuración CP858
3. **Imprime directamente** al dispositivo USB

## Comandos ESC/POS desde el Frontend

```javascript
const ESC = '\x1B';
const GS = '\x1D';

// Tamaños disponibles
const SIZE_1X = GS + '!' + '\x00';  // Normal
const SIZE_2X = GS + '!' + '\x11';  // Doble
const SIZE_3X = GS + '!' + '\x22';  // Triple (referencias)
const SIZE_4X = GS + '!' + '\x33';  // Cuádruple
const SIZE_8X = GS + '!' + '\x77';  // Máximo

// Ejemplo: Referencia en 3x3
let ticket = SIZE_3X + 'ALB-2024-001\n' + SIZE_1X;
ticket += 'Cliente: Juan Pérez\n';
```

✅ **Caracteres especiales funcionan**: € á é í ó ú ñ ¡ ¿ Ñ Á É Í Ó Ú

## Código simplificado:

Solo usamos **1 método** que funciona:
- RAW ESC/POS directamente al dispositivo
- Encoding CP858 para € y acentos
- Comandos simples y directos

## ⚠️ IMPORTANTE - Permisos requeridos:

```bash
# EJECUTAR PRIMERO (obligatorio):
sudo chmod 666 /dev/usb/lp0
```

## Cómo probar:

```bash
# 1. Dar permisos (si no lo has hecho)
sudo chmod 666 /dev/usb/lp0

# 2. Test rápido
npm test

# O directamente
curl -X POST http://localhost:20936/print/ticket \
  -H "Content-Type: application/json" \
  -d '{"text": "[LARGE]GRANDE[/LARGE]\nNormal\nEuro: €"}'

# Test de tamaños
curl -X POST http://localhost:20936/print/test-sizes
```

## Archivos clave:

- **`src/services/RawEscposService.js`** - Único servicio de impresión
- **`src/controllers/printController.js`** - Simplificado para usar solo RAW
- **`test-minimo-cp858.js`** - Prueba que confirmó que funciona

## Configuración mínima:

```javascript
// Reset y encoding
data += ESC + '@';
data += ESC + 't' + '\x13';  // CP858

// Texto grande
data += GS + '!' + '\x33';  // 4x4
data += 'GRANDE\n';
data += GS + '!' + '\x00';  // Normal

// Convertir y enviar
const buffer = iconv.encode(data, 'CP858');
fs.writeFileSync('/dev/usb/lp0', buffer);
```

## Si necesitas cambiar algo:

Todo el código de impresión está en:
`src/services/RawEscposService.js`

Tabla de etiquetas y tamaños:

| Nivel | Etiqueta | Código ESC/POS | Tamaño | Descripción |
|-------|----------|---------------|---------|-------------|
| 1 | (ninguna) | `\x00` | 1x1 | Texto normal |
| 2 | `[SIZE2]...[/SIZE2]` | `\x11` | 2x2 | Doble tamaño |
| 3 | `[LARGE]...[/LARGE]` | `\x22` | 3x3 | Triple tamaño |
| 4 | `[SIZE4]...[/SIZE4]` | `\x33` | 4x4 | Cuádruple tamaño |
| 5 | `[SIZE5]...[/SIZE5]` | `\x55` | 6x6 | Máximo tamaño |
| - | `[BOLD]...[/BOLD]` | ESC E 1/0 | - | Negrita (combinable) |

### Comparación visual (la palabra "Ratatouille"):
- **Nivel 1**: Ratatouille (normal)
- **Nivel 2**: El doble de grande
- **Nivel 3**: El triple de grande
- **Nivel 4**: Cuatro veces más grande
- **Nivel 5**: Seis veces más grande (máximo visible)