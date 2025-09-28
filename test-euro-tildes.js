#!/usr/bin/env node

const { PORT, HOST } = require('./config')
const http = require('http')

const testData = {
  text: `PRUEBA CARACTERES ESPECIALES

🧪 TEST EURO Y TILDES 🧪

Cliente: José María Peña
Dirección: C/ Corazón de María, 15
Teléfono: +34 91 234 56 78

Productos:
• Aceite motor 5W-40      28.90€
• Filtro de aire          15.50€
• Batería 12V             89.95€

Subtotal:                134.35€
IVA (21%):                28.21€
TOTAL:                   162.56€

¡Adiós! ¿Alguna duda?

ESPERADO:
✅ € → Se muestre como €
✅ á,é,í,ó,ú → Se muestren con tildes
✅ ñ → Se muestre como ñ
✅ ¡,¿ → Se muestren correctamente`
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

console.log('🧪 TEST EURO Y TILDES - Probando nuevos métodos de codificación')
console.log('')
console.log('📄 Este test incluye:')
console.log('   • Símbolo €')
console.log('   • Tildes: á, é, í, ó, ú')
console.log('   • Eñe: ñ')
console.log('   • Signos: ¡, ¿')
console.log('')
console.log('🔄 El servicio probará 3 métodos automáticamente:')
console.log('   1. Caracteres originales + CP850 (Europa)')
console.log('   2. UTF-8 nativo')
console.log('   3. Conversión a EUR/sin tildes (fallback)')
console.log('')

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

      if (result.method && result.method.includes('caracteres originales')) {
        console.log('🎉 ¡EXCELENTE! Se usó el método SIN conversión')
        console.log('   El € y las tildes deberían verse correctamente')
      } else if (result.method && result.method.includes('convertidos')) {
        console.log('⚠️  Se usó el método de conversión (fallback)')
        console.log('   Verás EUR en lugar de €, y letras sin tildes')
      }

      console.log('')
      console.log('👀 Revisa el ticket impreso:')
      console.log('   ¿Se ve € o EUR?')
      console.log('   ¿Se ven las tildes (á,é,í,ó,ú,ñ)?')
      console.log('')
      console.log('💡 Si aún no se ven bien, podemos probar más códigos de página')
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