#!/usr/bin/env node

/**
 * Test de impresión con iconv-lite (Solución #1)
 *
 * Este test verifica que los caracteres especiales se impriman correctamente
 * usando conversión UTF-8 → CP858 con iconv-lite.
 */

const { PORT, HOST } = require('./config')
const http = require('http')

const testData = {
  text: `PRUEBA ICONV-LITE
${new Date().toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })}

✨ TEST CARACTERES ESPECIALES ✨

Cliente: José María Pérez
Dirección: C/ Corazón de María, 15
Teléfono: +34 91 234 56 78

Productos:
• Piñón de embrague     15.50€
• Aceite motor 5W-40    28.90€
• Batería 12V           89.95€

Subtotal:              134.35€
IVA (21%):              28.21€
━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL:                 162.56€

¡Gracias! ¿Alguna duda?

ESPERADO:
✓ € → símbolo de euro
✓ á,é,í,ó,ú → con tildes
✓ ñ → eñe española
✓ ¡,¿ → signos españoles`
}

const postData = JSON.stringify(testData)

const options = {
  hostname: HOST,
  port: PORT,
  path: '/print/ticket',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}

console.log('🧪 TEST ICONV-LITE - Solución #1')
console.log('=' .repeat(50))
console.log('')
console.log('📋 Caracteres especiales incluidos:')
console.log('   • € (euro)')
console.log('   • á, é, í, ó, ú (tildes)')
console.log('   • ñ (eñe)')
console.log('   • ¡, ¿ (signos españoles)')
console.log('')
console.log('🔄 El servidor probará codificaciones en este orden:')
console.log('   1️⃣  CP858 (iconv-lite) - RECOMENDADO')
console.log('   2️⃣  CP850 (iconv-lite)')
console.log('   3️⃣  ISO-8859-15 (iconv-lite)')
console.log('   4️⃣  Windows-1252 (iconv-lite)')
console.log('   5️⃣  Fallback ASCII manual')
console.log('')
console.log('📤 Enviando impresión...')
console.log('')

const req = http.request(options, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    try {
      const result = JSON.parse(data)
      console.log('✅ Respuesta del servidor:')
      console.log('   Estado:', result.success ? '✓ ÉXITO' : '✗ ERROR')
      console.log('   Método:', result.method)
      console.log('   Detalles:', result.details)
      console.log('')

      if (result.method && result.method.includes('iconv-lite')) {
        console.log('🎉 ¡PERFECTO! Se usó iconv-lite (conversión real)')
        console.log('   Los caracteres € á é í ó ú ñ ¡ ¿ deberían verse correctamente')
      } else if (result.method && result.method.includes('manual')) {
        console.log('⚠️  Se usó conversión manual (fallback)')
        console.log('   Verás EUR en lugar de €, y letras sin tildes')
        console.log('   → Verifica que iconv-lite esté instalado: npm install iconv-lite')
      }

      console.log('')
      console.log('👀 Verifica el ticket impreso:')
      console.log('   ¿Se ve € o EUR?')
      console.log('   ¿Se ven las tildes correctamente?')
      console.log('   ¿Se ve la ñ?')
      console.log('')

    } catch (error) {
      console.error('❌ Error parseando respuesta:', data)
    }
  })
})

req.on('error', (error) => {
  console.error('❌ Error de conexión:', error.message)
  console.log('')
  console.log('💡 Soluciones:')
  console.log('   • Verifica que el servidor esté corriendo: node server.js')
  console.log('   • Verifica el puerto:', PORT)
})

req.write(postData)
req.end()