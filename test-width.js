#!/usr/bin/env node

/**
 * Test de alineación izquierda-derecha (compacto)
 */

const http = require('http');

const ESC = '\x1B';
const LF = '\n';
const HT = '\x09';
const ALIGN_LEFT = ESC + 'a' + '\x00';
const ALIGN_RIGHT = ESC + 'a' + '\x02';

let ticket = '';

ticket += 'TEST ALINEACION' + LF;
ticket += '================================' + LF;

// M1: Espacios manuales
ticket += 'M1-Espacios:' + LF;
ticket += 'Sabana' + ' '.repeat(48 - 6 - 16) + '4x 2.49€ = 9.96€' + LF;
ticket += 'Lavado' + ' '.repeat(48 - 6 - 18) + '1x 17.99€ = 17.99€' + LF;

// M2: Tab stop en col 28
ticket += 'M2-Tab28:' + LF;
ticket += ESC + 'D' + '\x1c' + '\x00';
ticket += 'Sabana' + HT + '4x 2.49€ = 9.96€' + LF;
ticket += 'Lavado' + HT + '1x 17.99€ = 17.99€' + LF;

// M3: Tab stop en col 30
ticket += 'M3-Tab30:' + LF;
ticket += ESC + 'D' + '\x1e' + '\x00';
ticket += 'Sabana' + HT + '4x 2.49€ = 9.96€' + LF;
ticket += 'Lavado' + HT + '1x 17.99€ = 17.99€' + LF;

// M4: Cambio align (probablemente no funciona)
ticket += 'M4-Align:' + LF;
ticket += ALIGN_LEFT + 'Sabana' + ALIGN_RIGHT + '4x 2.49€ = 9.96€' + LF;
ticket += ALIGN_LEFT + 'Lavado' + ALIGN_RIGHT + '1x 17.99€ = 17.99€' + LF;
ticket += ALIGN_LEFT;

// M5: Posición absoluta ESC $ (columna 224 = 28*8)
ticket += 'M5-Pos$:' + LF;
ticket += 'Sabana' + ESC + '$' + '\xe0' + '\x00' + '4x 2.49€ = 9.96€' + LF;
ticket += 'Lavado' + ESC + '$' + '\xe0' + '\x00' + '1x 17.99€ = 17.99€' + LF;

ticket += '================================' + LF;
ticket += '¿Cual alinea el € a la derecha?' + LF;

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
      console.log('✅ Test de ancho impreso correctamente');
      console.log('   Dispositivo:', response.device);
      console.log('\n📏 Instrucciones:');
      console.log('   1. Mira el ticket impreso');
      console.log('   2. Encuentra la última línea numérica que se ve completa');
      console.log('   3. Ese número es tu ancho máximo de papel');
      console.log('\n💡 Anchos típicos:');
      console.log('   - 32 caracteres: Papel de 58mm');
      console.log('   - 48 caracteres: Papel de 80mm (estándar)');
      console.log('   - 54-58 caracteres: Papel de 80mm con márgenes reducidos');
    } else {
      console.error('❌ Error:', response.error);
      if (response.details) {
        console.log('   Detalles:', response.details);
      }
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Error de conexión:', e.message);
  console.log('   Asegúrate de que el servicio esté ejecutándose:');
  console.log('   cd thermal-print-service && bun dev');
});

req.write(data);
req.end();