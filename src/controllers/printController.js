const { printWithLpr } = require('../services/LprService')
const { printWithNodeEscpos } = require('../services/EscposService')
const { printDirectToDevice } = require('../services/DirectPrintService')
const { printWithThermalPrinter } = require('../services/PrinterService')

/**
 * Print ticket endpoint with multiple fallback methods
 */
async function printTicket(req, res) {
  try {
    const { text } = req.body

    if (!text) {
      return res.status(400).json({ error: 'Falta el texto a imprimir' })
    }

    console.log('🖨️  Iniciando impresión...')

    let success = false
    let method = ''
    let details = ''

    try {
      const printer = await printWithLpr(text)
      success = true
      method = 'lpr'
      details = `Impresión exitosa con ${printer}`

    } catch (lprError) {

      try {
        const printer = await printWithNodeEscpos(text)
        success = true
        method = '@node-escpos'
        details = `Impresión exitosa con ${printer}`

      } catch (escposError) {

        try {
          const device = await printDirectToDevice(text)
          success = true
          method = 'direct-device'
          details = `Impresión directa exitosa en ${device}`

        } catch (directError) {

          try {
            const result = await printWithThermalPrinter(text)
            success = true
            method = 'node-thermal-printer'
            details = 'Impresión con librería exitosa'

          } catch (printerError) {
            throw new Error('Todos los métodos de impresión fallaron')
          }
        }
      }
    }

    if (success) {
      console.log(`✅ Ticket impreso: ${method}`)
      res.json({
        success: true,
        message: 'Ticket impreso correctamente',
        method: method,
        details: details,
        timestamp: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('❌ Error al imprimir:', error.message)

    res.status(500).json({
      error: 'Error al imprimir',
      details: error.message,
      suggestions: [
        'Verifica que la impresora esté conectada y encendida',
        'Verifica permisos: sudo chmod 666 /dev/usb/lp0',
        'Verifica CUPS: lpstat -p'
      ]
    })
  }
}

module.exports = {
  printTicket
}