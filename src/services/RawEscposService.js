const fs = require('fs')
const { execSync } = require('child_process')
const path = require('path')
const os = require('os')

// Nombre de la impresora en Windows
const WINDOWS_PRINTER_NAME = 'albaran'

/**
 * Impresión directa con buffer binario ESC/POS
 * El buffer ya viene generado desde el frontend con thermal-printer-encoder
 */
async function printWithRawBuffer(buffer) {
  const platform = process.platform

  if (platform === 'win32') {
    return printWindows(buffer)
  } else {
    return printLinux(buffer)
  }
}

/**
 * Impresión en Windows usando copy /b al share local de la impresora
 * Requiere que la impresora esté compartida en Windows
 */
async function printWindows(buffer) {
  const tempFile = path.join(os.tmpdir(), `thermal-${Date.now()}.bin`)

  try {
    // Escribir buffer a archivo temporal
    fs.writeFileSync(tempFile, buffer)
    console.log(`📄 Archivo temporal: ${tempFile} (${buffer.length} bytes)`)

    // Enviar directo al share local de la impresora
    execSync(`copy /b "${tempFile}" "\\\\localhost\\${WINDOWS_PRINTER_NAME}"`, {
      encoding: 'utf8',
      timeout: 10000,
      shell: true
    })

    console.log(`✅ Impresión en Windows: ${WINDOWS_PRINTER_NAME}`)
    return WINDOWS_PRINTER_NAME

  } catch (error) {
    console.error('❌ Error Windows:', error.message)
    throw new Error(`Error imprimiendo en Windows: ${error.message}`)
  } finally {
    // Limpiar archivo temporal
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
    } catch (e) {
      // Ignorar error de limpieza
    }
  }
}

/**
 * Impresión en Linux usando dispositivos /dev/usb/lp*
 */
async function printLinux(buffer) {
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
