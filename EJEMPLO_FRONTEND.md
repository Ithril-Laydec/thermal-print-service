# Ejemplo de uso desde el Frontend con ESC/POS directo

## Comandos ESC/POS básicos

```javascript
// Caracteres de control
const ESC = '\x1B';
const GS = '\x1D';
const LF = '\n';

// Tamaños de texto
const SIZE_NORMAL = GS + '!' + '\x00';  // 1x1
const SIZE_2X = GS + '!' + '\x11';      // 2x2
const SIZE_3X = GS + '!' + '\x22';      // 3x3 (para referencias)
const SIZE_4X = GS + '!' + '\x33';      // 4x4
const SIZE_6X = GS + '!' + '\x55';      // 6x6
const SIZE_8X = GS + '!' + '\x77';      // 8x8 (máximo)

// Negrita
const BOLD_ON = ESC + 'E' + '\x01';
const BOLD_OFF = ESC + 'E' + '\x00';
```

## Ejemplo: Ticket de Albarán con referencia en 3x3

```javascript
// En tu componente Vue
async function imprimirAlbaran(albaran) {
  // Construir el ticket con comandos ESC/POS
  let ticket = '';

  // Título centrado
  ticket += ESC + 'a' + '\x01';  // Centrar
  ticket += SIZE_3X + 'LA PLANCHADORA' + LF + SIZE_NORMAL;
  ticket += ESC + 'a' + '\x00';  // Izquierda

  ticket += '================================' + LF;

  // REFERENCIA EN TAMAÑO 3x3
  ticket += SIZE_3X;
  ticket += `ALBARÁN #${albaran.referencia}`;
  ticket += LF;
  ticket += SIZE_NORMAL;

  ticket += '================================' + LF;
  ticket += LF;

  // Cliente
  ticket += BOLD_ON + 'CLIENTE:' + BOLD_OFF + LF;
  ticket += albaran.cliente.nombre + LF;
  ticket += albaran.cliente.direccion + LF;
  ticket += albaran.cliente.telefono + LF;
  ticket += LF;

  // Artículos
  ticket += BOLD_ON + 'ARTÍCULOS:' + BOLD_OFF + LF;
  ticket += '--------------------------------' + LF;

  albaran.articulos.forEach(art => {
    ticket += `${art.cantidad}x ${art.nombre}` + LF;
    ticket += `   ${art.precio}€ = ${art.total}€` + LF;
  });

  ticket += '--------------------------------' + LF;

  // Total en tamaño grande
  ticket += SIZE_2X;
  ticket += BOLD_ON;
  ticket += `TOTAL: ${albaran.total}€`;
  ticket += BOLD_OFF;
  ticket += LF;
  ticket += SIZE_NORMAL;

  ticket += LF;
  ticket += '================================' + LF;
  ticket += `Fecha: ${new Date().toLocaleString('es-ES')}` + LF;

  // Enviar a imprimir
  try {
    const response = await fetch('http://localhost:20936/print/ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: ticket })
    });

    const result = await response.json();
    if (result.success) {
      console.log('✅ Impreso en:', result.device);
    }
  } catch (error) {
    console.error('Error al imprimir:', error);
  }
}
```

## Ejemplo más simple

```javascript
// Texto simple con referencia en 3x3
const ESC = '\x1B';
const GS = '\x1D';

let texto = '';

// Referencia del albarán en tamaño 3x3
texto += GS + '!' + '\x22';  // Tamaño 3x3
texto += 'ALB-2024-001\n';
texto += GS + '!' + '\x00';  // Volver a normal

texto += 'Cliente: Juan Pérez\n';
texto += 'Total: 125.50€\n';

// Enviar
await fetch('http://localhost:20936/print/ticket', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: texto })
});
```

## Referencia rápida de tamaños

| Comando | Tamaño | Uso típico |
|---------|--------|------------|
| `\x1D!\x00` | 1x1 | Texto normal |
| `\x1D!\x11` | 2x2 | Subtítulos |
| `\x1D!\x22` | 3x3 | **Referencias de albarán** |
| `\x1D!\x33` | 4x4 | Totales importantes |
| `\x1D!\x55` | 6x6 | Títulos grandes |
| `\x1D!\x77` | 8x8 | Máximo tamaño |

## Notas importantes

1. **No uses etiquetas** como `[LARGE]` - envía directamente los comandos ESC/POS
2. El servicio añade automáticamente:
   - Reset inicial (`ESC @`)
   - Configuración CP858 para € y acentos
   - Corte de papel al final
3. Los caracteres especiales (€, á, é, í, ó, ú, ñ) funcionan correctamente con CP858