const { printWithRawBuffer } = require('../services/RawEscposService')

/**
 * Endpoint de impresión - Recibe buffer binario ESC/POS directamente
 */
async function printRaw(req, res) {
  console.log('📥 POST /print recibido')
  console.log('📊 Platform:', process.platform)
  console.log('📊 Body length:', req.body?.length || 0)

  try {
    const buffer = Buffer.from(req.body)
    console.log('📊 Buffer length:', buffer.length)

    if (!buffer || buffer.length === 0) {
      console.log('❌ Buffer vacío')
      return res.status(400).json({ error: 'Buffer vacío' })
    }

    console.log('🖨️ Enviando a printWithRawBuffer...')
    const device = await printWithRawBuffer(buffer)
    console.log('✅ Impresión exitosa en:', device)

    res.json({
      success: true,
      device: device,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error completo:', error)
    console.error('❌ Stack:', error.stack)

    res.status(500).json({
      error: 'Error al imprimir',
      details: error.message,
      stack: error.stack,
      platform: process.platform
    })
  }
}

module.exports = {
  printRaw
}