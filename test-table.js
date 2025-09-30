#!/usr/bin/env node

/**
 * Test de alineación con columnas fijas calculadas dinámicamente
 * Formato: Artículo | Cant | P.Unit | = Total
 */

const http = require('http');
const LF = '\n';
const PAPER_WIDTH = 48;

/**
 * Calcula los anchos máximos necesarios para cada columna numérica
 * @param {Array} lines - Array de {article, quantity, unitPrice, total}
 * @returns {Object} {maxQtyWidth, maxUnitWidth, maxTotalWidth}
 */
function calculateColumnWidths(lines) {
  let maxQtyWidth = 0;
  let maxUnitWidth = 0;
  let maxTotalWidth = 0;

  for (const line of lines) {
    const qtyStr = `${line.quantity}x`;
    const unitStr = `${line.unitPrice.toFixed(2)}€`;
    const totalStr = `${line.total.toFixed(2)}€`;

    maxQtyWidth = Math.max(maxQtyWidth, qtyStr.length);
    maxUnitWidth = Math.max(maxUnitWidth, unitStr.length);
    maxTotalWidth = Math.max(maxTotalWidth, totalStr.length);
  }

  return { maxQtyWidth, maxUnitWidth, maxTotalWidth };
}

/**
 * Formatea una línea con anchos de columna fijos
 * @param {string} article - Nombre del artículo
 * @param {number} quantity - Cantidad
 * @param {number} unitPrice - Precio unitario
 * @param {number} total - Importe total
 * @param {Object} widths - Anchos fijos de columnas
 * @returns {string} Línea formateada de 48 caracteres
 */
function formatArticleLine(article, quantity, unitPrice, total, widths) {
  const { maxQtyWidth, maxUnitWidth, maxTotalWidth } = widths;

  // Formatear valores numéricos
  const qtyStr = `${quantity}x`;
  const unitStr = `${unitPrice.toFixed(2)}€`;
  const equalSign = '=';
  const totalStr = `${total.toFixed(2)}€`;

  // Espacios entre columnas
  const minSpace = 1;

  // Calcular espacio disponible para el artículo (ahora incluye columna "=")
  const numbersWidth = maxQtyWidth + minSpace + maxUnitWidth + minSpace + 1 + minSpace + maxTotalWidth;
  const articleMaxWidth = PAPER_WIDTH - numbersWidth - minSpace;

  // Truncar artículo si es necesario
  let articleStr = article;
  if (article.length > articleMaxWidth) {
    articleStr = article.substring(0, articleMaxWidth - 3) + '...';
  }

  // Padding para cada columna (alinear a la derecha)
  const articlePadding = articleMaxWidth - articleStr.length;
  const qtyPadding = maxQtyWidth - qtyStr.length;
  const unitPadding = maxUnitWidth - unitStr.length;
  const totalPadding = maxTotalWidth - totalStr.length;

  // Construir línea con todas las columnas alineadas (incluyendo "=")
  return articleStr +
         ' '.repeat(articlePadding + minSpace) +
         ' '.repeat(qtyPadding) + qtyStr +
         ' '.repeat(minSpace) +
         ' '.repeat(unitPadding) + unitStr +
         ' '.repeat(minSpace) +
         equalSign +
         ' '.repeat(minSpace) +
         ' '.repeat(totalPadding) + totalStr;
}

// Definir líneas de prueba
const testLines = [
  { article: 'Sabana', quantity: 4, unitPrice: 2.49, total: 9.96 },
  { article: 'Lavado', quantity: 1, unitPrice: 17.99, total: 17.99 },
  { article: 'Funda de almohada', quantity: 3, unitPrice: 0.89, total: 2.67 },
  { article: 'Edredon matrimonio', quantity: 2, unitPrice: 15.50, total: 31.00 },
  { article: 'Cortina', quantity: 10, unitPrice: 3.25, total: 32.50 },
  { article: 'Mantel grande', quantity: 1, unitPrice: 123.45, total: 123.45 },
  { article: 'Articulo con nombre muy largo que deberia truncarse', quantity: 5, unitPrice: 1.99, total: 9.95 },
  { article: 'Articulo extremadamente largo nombre completo', quantity: 123, unitPrice: 99.99, total: 12298.77 },
  { article: 'Traje de caballero de muchas piezas infinitas', quantity: 123, unitPrice: 993.99, total: 12298.77 },
  { article: 'Traje de caballero de muchas piezas infinitas', quantity: 1233, unitPrice: 993.99, total: 12298.77 }
];

// Calcular anchos de columnas
const widths = calculateColumnWidths(testLines);

let ticket = '';

ticket += 'TEST COLUMNAS ALINEADAS' + LF;
ticket += '='.repeat(48) + LF;

// Imprimir todas las líneas con columnas alineadas
for (const line of testLines) {
  ticket += formatArticleLine(line.article, line.quantity, line.unitPrice, line.total, widths) + LF;
}

ticket += '-'.repeat(48) + LF;
ticket += 'Cantidades, precios y totales alineados' + LF;
ticket += '='.repeat(48) + LF;

// Enviar al servicio
const data = JSON.stringify({ text: ticket });

const options = {
  hostname: 'localhost',
  port: 20936,
  path: '/print/ticket',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';

  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    const response = JSON.parse(body);
    if (response.success) {
      console.log('✅ Test de tablas impreso');
      console.log('   Revisa cual alinea mejor los € a la derecha');
    } else {
      console.error('❌ Error:', response.error);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Error de conexión:', e.message);
});

req.write(data);
req.end();