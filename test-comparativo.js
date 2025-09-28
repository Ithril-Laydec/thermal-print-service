#!/usr/bin/env node

const { PORT, HOST } = require('./config')
const http = require('http')

const testText = `COMPARACIÓN DE LIBRERÍAS
🆚 @node-escpos VS lpr

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

¿Cómo se ven?
• € = símbolo de euro
• á,é,í,ó,ú = tildes
• ñ = eñe española
• ¡,¿ = signos españoles

¡Adiós! ¿Alguna duda?`

function makeRequest(testNumber, description) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ text: testText })

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

    console.log(`\n🔄 TEST ${testNumber}: ${description}`)
    console.log('=' .repeat(50))

    const req = http.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          console.log(`✅ Resultado TEST ${testNumber}:`)
          console.log(`   Método usado: ${result.method}`)
          console.log(`   Detalles: ${result.details}`)

          if (result.method.includes('@node-escpos')) {
            console.log('   🆕 NUEVA LIBRERÍA - ¿Se ven € y tildes correctamente?')
          } else if (result.method.includes('lpr')) {
            console.log('   🔄 MÉTODO ANTERIOR - Probablemente EUR y sin tildes')
          }

          resolve({
            test: testNumber,
            method: result.method,
            details: result.details,
            success: result.success
          })
        } catch (error) {
          reject(`Error parseando respuesta TEST ${testNumber}: ${data}`)
        }
      })
    })

    req.on('error', (error) => {
      reject(`Error TEST ${testNumber}: ${error.message}`)
    })

    req.write(postData)
    req.end()
  })
}

async function runComparison() {
  console.log('🆚 COMPARACIÓN DE LIBRERÍAS PARA € Y TILDES')
  console.log('')
  console.log('📄 Vamos a imprimir el mismo texto y ver:')
  console.log('   • ¿Cuál método se usa primero?')
  console.log('   • ¿Se ven € y tildes correctamente?')
  console.log('   • ¿Cuál es más confiable?')
  console.log('')

  try {
    // Test 1: Primera impresión
    const result1 = await makeRequest(1, 'Primera impresión (método principal)')

    // Esperar un poco antes del segundo test
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Test 2: Segunda impresión para confirmar consistencia
    const result2 = await makeRequest(2, 'Segunda impresión (confirmar consistencia)')

    // Esperar un poco antes del tercer test
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Test 3: Tercera impresión
    const result3 = await makeRequest(3, 'Tercera impresión (validar estabilidad)')

    console.log('\n📊 RESUMEN DE RESULTADOS:')
    console.log('=' .repeat(50))

    const results = [result1, result2, result3]
    const methodCounts = {}

    results.forEach(result => {
      const method = result.method
      methodCounts[method] = (methodCounts[method] || 0) + 1
    })

    console.log('🔢 Métodos utilizados:')
    Object.entries(methodCounts).forEach(([method, count]) => {
      console.log(`   ${method}: ${count} veces`)
    })

    console.log('')
    console.log('🎯 ANÁLISIS:')

    if (results.every(r => r.method.includes('@node-escpos'))) {
      console.log('✅ EXCELENTE: @node-escpos/core funciona consistentemente')
      console.log('   → Debería mostrar € y tildes correctamente en todos los tickets')
      console.log('   → La nueva librería es estable y confiable')
    } else if (results.every(r => r.method.includes('lpr'))) {
      console.log('⚠️  FALLBACK: Cayó al método lpr (anterior)')
      console.log('   → La nueva librería tiene problemas de conexión/configuración')
      console.log('   → Verás EUR en lugar de € y letras sin tildes')
    } else {
      console.log('🔄 MIXTO: Resultados inconsistentes')
      console.log('   → Hay problemas de estabilidad')
      console.log('   → Revisar configuración USB o permisos')
    }

    console.log('')
    console.log('👀 INSTRUCCIONES PARA VERIFICAR:')
    console.log('1. Revisa los 3 tickets impresos')
    console.log('2. Compara cómo se ven:')
    console.log('   • € vs EUR')
    console.log('   • áéíóúñ vs aeioun')
    console.log('   • ¡¿ vs !?')
    console.log('3. Reporta cuál se ve mejor')

  } catch (error) {
    console.error('❌ Error en comparación:', error)
    console.log('')
    console.log('💡 Asegúrate de que el servidor esté ejecutándose:')
    console.log('   cd thermal-print-service && bun start')
  }
}

runComparison()