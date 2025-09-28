#!/usr/bin/env node

const { PORT, HOST } = require('./config')
const http = require('http')

const testData = {
  text: `PRUEBA DE CARACTERES ESPECIALES
Fecha: ${new Date().toLocaleDateString('es-ES')}

Cliente: José María Peña
Dirección: C/ Corazón de María nº 15
Teléfono: +34 91 234 56 78

Productos:
• Piñón de embrague     15.50€
• Aceite 5W-40          28.90€
• Batería 12V           89.95€

Subtotal:              134.35€
IVA (21%):              28.21€
TOTAL:                 162.56€

¡Gracias por su compra!
¿Dudas? ¡Llámenos!`
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

console.log('🧪 Probando impresión con caracteres especiales...')
console.log('📄 Este test incluye: tildes (á,é,í,ó,ú), ñ, € y otros caracteres')

const req = http.request(options, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    try {
      const result = JSON.parse(data)
      console.log('')
      console.log('✅ Respuesta del servidor:')
      console.log('   Éxito:', result.success)
      console.log('   Método usado:', result.method)
      console.log('   Detalles:', result.details)
      console.log('')
      console.log('🎯 En el ticket impreso deberías ver:')
      console.log('   € → EUR')
      console.log('   á,é,í,ó,ú → a,e,i,o,u')
      console.log('   ñ → n')
      console.log('   Todo sin caracteres raros ✨')
    } catch (error) {
      console.log('❌ Error parseando respuesta:', data)
    }
  })
})

req.on('error', (error) => {
  console.error('❌ Error:', error.message)
  console.log('💡 Asegúrate de que el servidor esté ejecutándose: bun start')
})

req.write(postData)
req.end()