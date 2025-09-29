const { encodeTextForPrinter } = require('../utils/encoding')
const iconv = require('iconv-lite')

/**
 * Función de fallback: impresión directa bypass librería
 */
async function printDirectToDevice(text) {
  const fs = require('fs').promises
  const encoded = encodeTextForPrinter(text, 'CP858')

  const header = Buffer.from([0x1B, 0x40, 0x1B, 0x74, 0x13, 0x1B, 0x61, 0x00])
  const footer = Buffer.from([0x0A, 0x0A, 0x1D, 0x56, 0x00])

  const escPosBuffer = Buffer.concat([header, encoded.buffer, footer])
  const devices = ['/dev/usb/lp0', '/dev/usb/lp1', '/dev/lp0', '/dev/lp1']

  for (const device of devices) {
    try {
      await fs.writeFile(device, escPosBuffer)
      console.log(`✅ Impresión directa exitosa: ${device}`)
      return device
    } catch (error) {
      continue
    }
  }

  throw new Error('No se pudo acceder a ningún dispositivo de impresión')
}

module.exports = {
  printDirectToDevice
}