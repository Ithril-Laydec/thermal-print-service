#!/usr/bin/env node

/**
 * Test simple del servicio con ESC/POS directo
 * Imprime un albarán de ejemplo con referencia en 3x3
 */

const http = require('http');

// Comandos ESC/POS
const ESC = '\x1B';
const GS = '\x1D';
const LF = '\n';

// Tamaños
const SIZE_NORMAL = GS + '!' + '\x00';
const SIZE_2X = GS + '!' + '\x11';
const SIZE_3X = GS + '!' + '\x22';  // Para la referencia

// Formato
const BOLD_ON = ESC + 'E' + '\x01';
const BOLD_OFF = ESC + 'E' + '\x00';

// Construir ticket de prueba
let ticket = '';

// Título
ticket += 'LA PLANCHADORA' + LF;
ticket += '================================' + LF + LF;

// REFERENCIA EN TAMAÑO 3x3
ticket += SIZE_3X;
ticket += 'ALB-2024-001';
ticket += LF;
ticket += SIZE_NORMAL;

ticket += LF;
ticket += '================================' + LF + LF;

// Datos
ticket += 'Fecha: ' + new Date().toLocaleDateString('es-ES') + LF + LF;

ticket += BOLD_ON + 'CLIENTE:' + BOLD_OFF + LF;
ticket += 'José María García' + LF;
ticket += 'C/ Ñoño, 123' + LF;
ticket += 'Tel: 666 123 456' + LF + LF;

ticket += BOLD_ON + 'ARTÍCULOS:' + BOLD_OFF + LF;
ticket += '--------------------------------' + LF;
ticket += '2x Camisa       3.50€ =  7.00€' + LF;
ticket += '1x Pantalón     4.00€ =  4.00€' + LF;
ticket += '3x Camiseta     2.50€ =  7.50€' + LF;
ticket += '--------------------------------' + LF + LF;

// Total en 2x2
ticket += SIZE_2X;
ticket += BOLD_ON;
ticket += 'TOTAL: 18.50€';
ticket += BOLD_OFF;
ticket += SIZE_NORMAL;
ticket += LF + LF;

ticket += '================================' + LF;
ticket += 'Gracias por su confianza' + LF;

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
      console.log('✅ Albarán impreso correctamente');
      console.log('   Dispositivo:', response.device);
      console.log('\n📋 El ticket incluye:');
      console.log('   - Referencia ALB-2024-001 en tamaño 3x3');
      console.log('   - Cliente con caracteres especiales (ñ)');
      console.log('   - Total en tamaño 2x2 con negrita');
      console.log('   - Símbolo € correctamente impreso');
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
  console.log('   bun dev');
});

req.write(data);
req.end();