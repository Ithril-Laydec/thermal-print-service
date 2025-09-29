const { exec } = require('child_process')
const { promisify } = require('util')
const os = require('os')

const execAsync = promisify(exec)

/**
 * Detectar impresoras térmicas disponibles
 */
async function detectThermalPrinters() {
  try {
    const { stdout: lsusbOutput } = await execAsync('lsusb')
    const { stdout: cupsPrinters } = await execAsync('lpstat -p -d 2>/dev/null || echo "No CUPS printers"')
    const { stdout: serialDevs } = await execAsync('ls /dev/tty* 2>/dev/null | grep -E "(USB|ACM)" || echo "No serial devices"')

    console.log('🖨️  Impresoras CUPS:', cupsPrinters.trim())

    return {
      usb: lsusbOutput,
      cups: cupsPrinters,
      serial: serialDevs
    }
  } catch (error) {
    return null
  }
}

/**
 * Obtener información del sistema
 */
function getSystemInfo() {
  return {
    platform: os.platform(),
    arch: os.arch(),
    totalMemory: Math.round(os.totalmem() / 1024 / 1024),
    freeMemory: Math.round(os.freemem() / 1024 / 1024),
    usedMemory: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024),
    nodeVersion: process.version
  }
}

/**
 * Obtener impresoras configuradas según el sistema operativo
 */
async function getConfiguredPrinters() {
  let printersConfigured = []
  try {
    if (os.platform() === 'linux') {
      const { stdout } = await execAsync('lpstat -p 2>/dev/null || echo "No printers"')
      printersConfigured = stdout.split('\n').filter(line => line.includes('printer')).map(line => {
        const match = line.match(/printer\s+(\S+)/)
        return match ? match[1] : null
      }).filter(Boolean)
    } else if (os.platform() === 'win32') {
      const { stdout } = await execAsync('wmic printer get name')
      printersConfigured = stdout.split('\n').slice(1).filter(line => line.trim())
    }
  } catch {}

  return printersConfigured
}

module.exports = {
  detectThermalPrinters,
  getSystemInfo,
  getConfiguredPrinters,
  execAsync
}