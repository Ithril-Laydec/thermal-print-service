const { detectThermalPrinters } = require('../utils/system')

/**
 * List available printers endpoint
 */
async function getPrinters(req, res) {
  try {
    console.log('🔍 Solicitada detección de impresoras...')
    const detection = await detectThermalPrinters()

    res.json({
      message: 'Detección de impresoras completada',
      detection: detection,
      availableInterfaces: [
        'printer:auto',
        '/dev/usb/lp0',
        '/dev/usb/lp1',
        'tcp://192.168.1.100:9100'
      ]
    })
  } catch (error) {
    console.error('❌ Error detectando impresoras:', error.message)
    res.status(500).json({ error: error.message })
  }
}

/**
 * Complete diagnostics endpoint
 */
async function getDiagnostics(req, res) {
  try {
    console.log('🔍 Ejecutando diagnóstico completo...')

    const detection = await detectThermalPrinters()

    res.json({
      service: 'thermal-print-service',
      status: 'running',
      port: process.env.PORT || 20936,
      timestamp: new Date().toISOString(),
      detection: detection,
      recommendations: ['Servicio funcionando correctamente']
    })
  } catch (error) {
    res.status(500).json({
      error: 'Error en diagnóstico',
      details: error.message
    })
  }
}

/**
 * Quick printer availability check
 * Devuelve si la impresora está encendida y disponible
 */
async function checkPrinterAvailability(req, res) {
  try {
    const detection = await detectThermalPrinters()
    const available = detection.usbConnected || detection.cupsAvailable

    res.json({
      available: available,
      status: available ? 'online' : 'offline',
      message: available ? 'Impresora disponible' : 'Impresora no disponible',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.json({
      available: false,
      status: 'offline',
      message: 'Error verificando impresora',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}

module.exports = {
  getPrinters,
  getDiagnostics,
  checkPrinterAvailability
}