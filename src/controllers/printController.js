const { printWithRawEscpos, printWithRawBuffer } = require('../services/RawEscposService')

/**
 * Endpoint de impresión - Recibe texto con comandos ESC/POS
 */
async function printTicket(req, res) {
  try {
    const { text } = req.body

    if (!text) {
      return res.status(400).json({ error: 'Falta el texto a imprimir' })
    }

    const device = await printWithRawEscpos(text)

    res.json({
      success: true,
      device: device,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error:', error.message)

    res.status(500).json({
      error: 'Error al imprimir',
      details: error.message
    })
  }
}

/**
 * Endpoint de impresión RAW - Recibe buffer binario ESC/POS directamente
 */
async function printRaw(req, res) {
  try {
    // El body ya es un Buffer con los comandos ESC/POS
    const buffer = Buffer.from(req.body)

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'Buffer vacío' })
    }

    const device = await printWithRawBuffer(buffer)

    res.json({
      success: true,
      device: device,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error:', error.message)

    res.status(500).json({
      error: 'Error al imprimir',
      details: error.message
    })
  }
}

module.exports = {
  printTicket,
  printRaw
}