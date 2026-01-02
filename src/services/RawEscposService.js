const fs = require('fs')
const { execSync } = require('child_process')
const path = require('path')
const os = require('os')

// Nombres de impresoras en Windows
const WINDOWS_PRINTER_NAME = 'albaran'
const WINDOWS_PRINTER_DIPLODOCUS = 'diplodocus'
const WINDOWS_SATO_NAMES = ['SATO WS412', 'ETIQUETADORA', 'Etiquetas']

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
  const rawPrintExe = path.join(__dirname, '..', '..', 'installers', 'bin', 'RawPrint.exe')

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
  const rawPrintExe = path.join(__dirname, '..', '..', 'installers', 'bin', 'RawPrint.exe')

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

// Caché de impresora SATO para evitar llamadas repetidas a wmic
let cachedSatoPrinter = null

/**
 * Busca la primera impresora disponible entre los nombres dados (Windows)
 * Usa wmic en lugar de PowerShell para evitar timeouts cuando corre como SYSTEM
 * Cachea el resultado para evitar procesos zombie por timeouts
 */
function findWindowsPrinter(names) {
  // Retornar caché si existe
  if (cachedSatoPrinter) {
    return cachedSatoPrinter
  }

  try {
    const result = execSync('wmic printer get name', {
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true
    })
    // wmic output: primera línea es "Name", resto son nombres con espacios trailing
    const installed = result.split('\n').slice(1).map(p => p.trim()).filter(Boolean)
    const found = names.find(name => installed.includes(name))
    if (found) {
      cachedSatoPrinter = found
      console.log(`Impresora SATO cacheada: ${found}`)
    }
    return found
  } catch (error) {
    console.error('Error buscando impresoras:', error.message)
    return null
  }
}

/**
 * Impresión a SATO WS412 (etiquetas SBPL)
 * Usa CUPS en Linux, RawPrint en Windows
 */
async function printToSato(buffer) {
  const platform = process.platform

  if (platform === 'win32') {
    const printerName = findWindowsPrinter(WINDOWS_SATO_NAMES)
    if (!printerName) {
      throw new Error(`No se encontró impresora SATO. Nombres buscados: ${WINDOWS_SATO_NAMES.join(', ')}`)
    }
    console.log(`Impresora SATO encontrada: ${printerName}`)
    return printWindowsToPrinter(buffer, printerName)
  } else {
    return printLinuxToSato(buffer)
  }
}

/**
 * Impresión a SATO en Linux usando CUPS
 */
async function printLinuxToSato(buffer) {
  const tempFile = path.join(os.tmpdir(), `sato-${Date.now()}.bin`)
  const cupsQueue = 'Albaranes'

  try {
    fs.writeFileSync(tempFile, buffer)
    console.log(`Archivo temporal SATO: ${tempFile} (${buffer.length} bytes)`)

    execSync(`lp -d ${cupsQueue} -o raw "${tempFile}"`, {
      encoding: 'utf8',
      timeout: 30000
    })

    console.log(`✅ Impresión SATO en cola ${cupsQueue}`)
    return cupsQueue

  } catch (error) {
    console.error('Error SATO:', error.message)
    throw new Error(`Error imprimiendo en SATO: ${error.message}`)
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
  printToDiplodocus,
  printToSato
}
