// Script para probar la impresión desde línea de comandos
const http = require('http')
const { PORT, HOST } = require('./config')

const testData = {
  text: `PRUEBA DE IMPRESIÓN
Fecha: ${new Date().toLocaleDateString('es-ES')}
Hora: ${new Date().toLocaleTimeString('es-ES')}

Albarán: ALB-001
Cliente: Cliente de Prueba
Total: 25.50€

¡Funcionando correctamente!`
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

console.log('🧪 Enviando prueba de impresión...')

const req = http.request(options, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    console.log('📨 Respuesta del servidor:')
    console.log(JSON.parse(data))
  })
})

req.on('error', (error) => {
  console.error('❌ Error:', error.message)
  console.log('💡 Asegúrate de que el servidor esté ejecutándose: npm start')
})

req.write(postData)
req.end()