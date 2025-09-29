const { detectThermalPrinters } = require('../utils/system')
const { createPrinter } = require('../services/PrinterService')

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

    // Intentar crear una impresora para verificar configuración
    let printerConfig = null
    let printerError = null

    try {
      await createPrinter()
      printerConfig = 'Configuración exitosa'
    } catch (error) {
      printerError = error.message
    }

    res.json({
      service: 'thermal-print-service',
      status: 'running',
      port: process.env.PORT || 20936,
      timestamp: new Date().toISOString(),
      detection: detection,
      printerConfiguration: {
        success: !!printerConfig,
        message: printerConfig || printerError
      },
      recommendations: printerError ? [
        'Verifica que la impresora esté conectada y encendida',
        'Ejecuta: npm run install-drivers',
        'Comprueba que existe impresora "ALBARAN" o "Albaranes" en CUPS'
      ] : ['Todo configurado correctamente']
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
    // Intentar crear una conexión con la impresora
    const printer = await createPrinter()

    res.json({
      available: true,
      status: 'online',
      message: 'Impresora disponible y lista para imprimir',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    // Si falla, la impresora no está disponible
    res.json({
      available: false,
      status: 'offline',
      message: 'Impresora no disponible',
      error: error.message,
      suggestions: [
        'Verifica que la impresora esté encendida',
        'Comprueba que la impresora esté conectada',
        'Verifica la configuración en CUPS'
      ],
      timestamp: new Date().toISOString()
    })
  }
}

module.exports = {
  getPrinters,
  getDiagnostics,
  checkPrinterAvailability
}