const fs = require('fs')
const { execSync } = require('child_process')
const path = require('path')
const os = require('os')

// Nombres de impresoras en Windows
const WINDOWS_PRINTER_NAME = 'albaran'
const WINDOWS_PRINTER_DIPLODOCUS = 'diplodocus'

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
 * Impresión en Windows usando RawPrint.exe (winspool.drv nativo)
 * El ejecutable precompilado evita la compilación en runtime de Add-Type
 */
async function printWindows(buffer) {
  const tempFile = path.join(os.tmpdir(), `thermal-${Date.now()}.bin`)
  const rawPrintExe = path.join(__dirname, '..', '..', 'RawPrint.exe')

  try {
    fs.writeFileSync(tempFile, buffer)
    console.log(`Archivo temporal: ${tempFile} (${buffer.length} bytes)`)

    const result = execSync(`"${rawPrintExe}" "${WINDOWS_PRINTER_NAME}" "${tempFile}"`, {
      encoding: 'utf8',
      timeout: 30000,
      windowsHide: true
    })

    console.log(`Impresion en Windows: ${result.trim()}`)
    return WINDOWS_PRINTER_NAME

  } catch (error) {
    console.error('Error Windows:', error.message)
    throw new Error(`Error imprimiendo en Windows: ${error.message}`)
  } finally {
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
    } catch (e) {}
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

/**
 * Impresión a diplodocus (EPSON LQ-590 matricial)
 * Acepta buffer binario ESC/P2 o texto plano
 */
async function printToDiplodocus(buffer) {
  const platform = process.platform

  if (platform === 'win32') {
    return printWindowsToPrinter(buffer, WINDOWS_PRINTER_DIPLODOCUS)
  } else {
    return printLinuxToDiplodocus(buffer)
  }
}

/**
 * Impresión a diplodocus en Linux usando symlink udev
 */
async function printLinuxToDiplodocus(buffer) {
  const device = '/dev/printer/diplodocus'

  if (!fs.existsSync(device)) {
    throw new Error('Diplodocus no conectada. Verifica conexión USB y ejecuta: sudo udevadm trigger')
  }

  try {
    fs.accessSync(device, fs.constants.W_OK)
  } catch (err) {
    throw new Error(`Sin permisos en ${device}. Ejecuta: sudo chmod 666 ${device}`)
  }

  fs.writeFileSync(device, buffer)
  console.log(`✅ Impresión en ${device}`)
  return device
}

/**
 * Impresión genérica en Windows a cualquier impresora
 */
async function printWindowsToPrinter(buffer, printerName) {
  const tempFile = path.join(os.tmpdir(), `print-${Date.now()}.bin`)
  const rawPrintExe = path.join(__dirname, '..', '..', 'RawPrint.exe')

  try {
    fs.writeFileSync(tempFile, buffer)
    console.log(`Archivo temporal: ${tempFile} (${buffer.length} bytes)`)

    const result = execSync(`"${rawPrintExe}" "${printerName}" "${tempFile}"`, {
      encoding: 'utf8',
      timeout: 30000,
      windowsHide: true
    })

    console.log(`Impresion en ${printerName}: ${result.trim()}`)
    return printerName

  } catch (error) {
    console.error('Error Windows:', error.message)
    throw new Error(`Error imprimiendo en ${printerName}: ${error.message}`)
  } finally {
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
    } catch (e) {}
  }
}

module.exports = {
  printWithRawBuffer,
  printToDiplodocus
}
