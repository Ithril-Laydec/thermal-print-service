#!/usr/bin/env node

const http = require('http')
const { PORT, HOST } = require('./config')

function checkService() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: '/diagnostics',
      method: 'GET',
      timeout: 5000
    }

    console.log('🔍 Verificando instalación del servicio de impresión...')
    console.log('=' .repeat(60))

    const req = http.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          resolve(result)
        } catch (error) {
          reject(new Error('Respuesta no válida del servidor'))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Timeout: El servicio no responde'))
    })

    req.end()
  })
}

async function main() {
  try {
    const diagnostic = await checkService()

    console.log(`✅ Servicio ejecutándose en puerto ${diagnostic.port}`)
    console.log(`⏰ Última verificación: ${new Date(diagnostic.timestamp).toLocaleString()}`)
    console.log('')

    if (diagnostic.printerConfiguration.success) {
      console.log('🖨️  ✅ Configuración de impresora: CORRECTA')
      console.log(`   ${diagnostic.printerConfiguration.message}`)
      console.log('')
      console.log('🎉 ¡Todo listo para imprimir!')
      console.log('   Puedes usar la aplicación Vue normalmente')

    } else {
      console.log('🖨️  ❌ Configuración de impresora: PROBLEMA')
      console.log(`   Error: ${diagnostic.printerConfiguration.message}`)
      console.log('')
      console.log('🔧 Recomendaciones:')
      diagnostic.recommendations.forEach(rec => {
        console.log(`   • ${rec}`)
      })
    }

    console.log('')
    console.log('📊 Detalles de detección:')
    if (diagnostic.detection) {
      console.log('   USB:', diagnostic.detection.usb ? '✅ Detectado' : '❌ No detectado')
      console.log('   CUPS:', diagnostic.detection.cups ? '✅ Disponible' : '❌ No disponible')
      console.log('   Serie:', diagnostic.detection.serial ? '✅ Detectado' : '❌ No detectado')
    }

    console.log('')
    console.log('🌐 Endpoints disponibles:')
    console.log(`   http://${HOST}:${PORT}/health`)
    console.log(`   http://${HOST}:${PORT}/printers`)
    console.log(`   http://${HOST}:${PORT}/diagnostics`)

  } catch (error) {
    console.log('❌ Error verificando servicio:')
    console.log(`   ${error.message}`)
    console.log('')
    console.log('🔧 Posibles soluciones:')
    console.log('   • Verifica que el servicio esté ejecutándose: bun start')
    console.log('   • Comprueba el puerto en config.js')
    console.log('   • Instala drivers: npm run install-drivers')
  }
}

if (require.main === module) {
  main()
}

module.exports = { checkService }