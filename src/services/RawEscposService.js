const fs = require('fs')

/**
 * Impresión directa con buffer binario ESC/POS
 * El buffer ya viene generado desde el frontend con thermal-printer-encoder
 */
async function printWithRawBuffer(buffer) {
  const devices = ['/dev/usb/lp0', '/dev/usb/lp1', '/dev/lp0']
  let lastError = null

  for (const device of devices) {
    try {
      if (!fs.existsSync(device)) continue

      // Verificar permisos
      try {
        fs.accessSync(device, fs.constants.W_OK)
      } catch (err) {
        lastError = `Sin permisos. Ejecuta: sudo chmod 666 ${device}`
        console.log(`❌ ${lastError}`)
        continue
      }

      // Escribir buffer directamente
      fs.writeFileSync(device, buffer)

      console.log(`✅ Impresión en ${device}`)
      return device

    } catch (error) {
      lastError = error.message
      continue
    }
  }

  throw new Error(lastError || 'No se pudo imprimir. Ejecuta: sudo chmod 666 /dev/usb/lp0')
}

module.exports = {
  printWithRawBuffer
}