/**
 * Ejemplo para Vue: Imprimir albarán con referencia en 3x3
 * Usa comandos ESC/POS directamente desde el frontend
 */

// Constantes ESC/POS (puedes ponerlas en un archivo constants.js)
const ESC = '\x1B';
const GS = '\x1D';
const LF = '\n';

// Tamaños
const SIZE_NORMAL = GS + '!' + '\x00';  // 1x1
const SIZE_2X = GS + '!' + '\x11';      // 2x2
const SIZE_3X = GS + '!' + '\x22';      // 3x3 (para referencias)
const SIZE_4X = GS + '!' + '\x33';      // 4x4

// Formato
const BOLD_ON = ESC + 'E' + '\x01';
const BOLD_OFF = ESC + 'E' + '\x00';
const CENTER = ESC + 'a' + '\x01';
const LEFT = ESC + 'a' + '\x00';

/**
 * Función para imprimir albarán
 */
export async function imprimirAlbaran(albaran) {
  let ticket = '';

  // Encabezado
  ticket += CENTER;
  ticket += 'LA PLANCHADORA' + LF;
  ticket += 'Servicio de Planchado' + LF;
  ticket += LEFT;
  ticket += '================================' + LF + LF;

  // REFERENCIA DEL ALBARÁN EN TAMAÑO 3x3
  ticket += SIZE_3X;
  ticket += `ALB-${albaran.numero}`;
  ticket += LF;
  ticket += SIZE_NORMAL;

  ticket += LF;
  ticket += '================================' + LF + LF;

  // Fecha
  ticket += `Fecha: ${albaran.fecha}` + LF + LF;

  // Cliente
  ticket += BOLD_ON + 'CLIENTE:' + BOLD_OFF + LF;
  ticket += albaran.cliente + LF;
  if (albaran.direccion) {
    ticket += albaran.direccion + LF;
  }
  if (albaran.telefono) {
    ticket += `Tel: ${albaran.telefono}` + LF;
  }
  ticket += LF;

  // Artículos
  ticket += BOLD_ON + 'ARTÍCULOS:' + BOLD_OFF + LF;
  ticket += '--------------------------------' + LF;

  let total = 0;
  albaran.articulos.forEach(art => {
    const subtotal = art.cantidad * art.precio;
    total += subtotal;

    ticket += `${art.cantidad}x ${art.descripcion}` + LF;
    ticket += `   ${art.precio.toFixed(2)}€ = ${subtotal.toFixed(2)}€` + LF;
  });

  ticket += '--------------------------------' + LF + LF;

  // Total en tamaño 2x2
  ticket += SIZE_2X;
  ticket += BOLD_ON;
  ticket += `TOTAL: ${total.toFixed(2)}€`;
  ticket += BOLD_OFF;
  ticket += SIZE_NORMAL;
  ticket += LF + LF;

  // Pie
  ticket += '================================' + LF;
  ticket += CENTER;
  ticket += 'Gracias por su confianza' + LF;
  ticket += LEFT;

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
      console.log('✅ Albarán impreso en:', result.device);
      return true;
    } else {
      console.error('❌ Error al imprimir:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error de conexión:', error);
    return false;
  }
}

/**
 * Ejemplo de uso en componente Vue
 */
/*
<template>
  <button @click="imprimir">Imprimir Albarán</button>
</template>

<script setup>
import { imprimirAlbaran } from './ejemplo-albaran-vue.js';

const albaran = {
  numero: '2024-001',
  fecha: new Date().toLocaleDateString('es-ES'),
  cliente: 'María García',
  direccion: 'C/ Mayor, 123',
  telefono: '666 123 456',
  articulos: [
    { cantidad: 2, descripcion: 'Camisa', precio: 3.50 },
    { cantidad: 1, descripcion: 'Pantalón', precio: 4.00 },
    { cantidad: 3, descripcion: 'Camiseta', precio: 2.50 }
  ]
};

async function imprimir() {
  const exito = await imprimirAlbaran(albaran);
  if (exito) {
    // Mostrar notificación de éxito
  }
}
</script>
*/