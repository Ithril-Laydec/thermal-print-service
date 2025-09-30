const fs = require('fs');
const iconv = require('iconv-lite');

/**
 * Impresión directa con ESC/POS y CP858
 * El texto ya viene con comandos ESC/POS desde el frontend
 */
async function printWithRawEscpos(text) {
  const ESC = '\x1B';
  const GS = '\x1D';

  // Dispositivos posibles
  const devices = ['/dev/usb/lp0', '/dev/usb/lp1', '/dev/lp0'];

  let lastError = null;

  for (const device of devices) {
    try {
      if (!fs.existsSync(device)) continue;

      // Verificar permisos
      try {
        fs.accessSync(device, fs.constants.W_OK);
      } catch (err) {
        lastError = `Sin permisos. Ejecuta: sudo chmod 666 ${device}`;
        console.log(`❌ ${lastError}`);
        continue;
      }

      // Preparar datos con reset y CP858
      let data = '';
      data += ESC + '@';                // Reset impresora
      data += ESC + 't' + '\x13';        // Configurar CP858 para € y acentos
      data += text;                      // El texto ya viene con comandos ESC/POS
      data += '\n\n' + GS + 'V' + '\x42' + '\x00';  // Cortar papel

      // Convertir a CP858 y escribir
      const dataBuffer = iconv.encode(data, 'CP858');
      fs.writeFileSync(device, dataBuffer);

      console.log(`✅ Impresión en ${device}`);
      return device;

    } catch (error) {
      lastError = error.message;
      continue;
    }
  }

  throw new Error(lastError || 'No se pudo imprimir. Ejecuta: sudo chmod 666 /dev/usb/lp0');
}

/**
 * Impresión directa con buffer binario ESC/POS
 * El buffer ya viene generado desde el frontend con thermal-printer-encoder
 */
async function printWithRawBuffer(buffer) {
  // Dispositivos posibles
  const devices = ['/dev/usb/lp0', '/dev/usb/lp1', '/dev/lp0'];

  let lastError = null;

  for (const device of devices) {
    try {
      if (!fs.existsSync(device)) continue;

      // Verificar permisos
      try {
        fs.accessSync(device, fs.constants.W_OK);
      } catch (err) {
        lastError = `Sin permisos. Ejecuta: sudo chmod 666 ${device}`;
        console.log(`❌ ${lastError}`);
        continue;
      }

      // Escribir buffer directamente
      fs.writeFileSync(device, buffer);

      console.log(`✅ Impresión RAW en ${device}`);
      return device;

    } catch (error) {
      lastError = error.message;
      continue;
    }
  }

  throw new Error(lastError || 'No se pudo imprimir. Ejecuta: sudo chmod 666 /dev/usb/lp0');
}

module.exports = {
  printWithRawEscpos,
  printWithRawBuffer
}