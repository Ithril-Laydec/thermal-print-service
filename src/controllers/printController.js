const { printWithRawBuffer } = require('../services/RawEscposService')

/**
 * Endpoint de impresión - Recibe buffer binario ESC/POS directamente
 */
async function printRaw(req, res) {
  try {
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
  printRaw
}