const { app, PORT, HOST } = require('./app')
const AutoSetup = require('./services/auto-setup')
const { detectThermalPrinters } = require('./utils/system')
const { checkForUpdates } = require('./utils/update-checker')
const packageJson = require('../package.json')

async function startServer() {
  console.log('🚀 Iniciando servicio de impresión térmica...')
  console.log('=' .repeat(50))

  // 1. AUTO-SETUP INTELIGENTE 🤖
  const autoSetup = new AutoSetup()
  console.log('🔧 Verificando y configurando drivers automáticamente...')

  try {
    const driversOk = await autoSetup.checkAndInstallDrivers()
    if (!driversOk) {
      console.log('⚠️  Advertencia: Drivers no configurados óptimamente')
      console.log('   El servicio continuará, pero puede tener problemas de impresión')
    }

    // 2. Verificar conexión de impresora
    await autoSetup.checkPrinterConnection()

  } catch (error) {
    console.log('⚠️  Error en configuración automática:', error.message)
    console.log('   El servicio continuará con configuración básica')
  }

  console.log('')
  console.log('🖨️  Iniciando servidor HTTP...')

  // 3. Ejecutar detección de impresoras
  await detectThermalPrinters()

  // 4. Iniciar servidor
  app.listen(PORT, async () => {
    console.log('')
    console.log('✅ Servicio de impresión térmica LISTO')
    console.log(`📡 Servidor ejecutándose en http://${HOST}:${PORT}`)
    console.log(`📦 Versión: ${packageJson.version}`)

    // 5. Verificar actualizaciones
    try {
      const updateInfo = await checkForUpdates()
      if (updateInfo.updateAvailable) {
        console.log('')
        console.log('🔔 ACTUALIZACIÓN DISPONIBLE!')
        console.log(`   Versión actual: ${updateInfo.currentVersion}`)
        console.log(`   Nueva versión: ${updateInfo.latestVersion}`)
        console.log(`   Actualiza con: git pull && npm install && npm start`)
        console.log('')
      }
    } catch (error) {
      // Silently fail update check
    }

    console.log(`🔧 Endpoints disponibles:`)
    console.log(`   POST /print/ticket    - Imprimir ticket`)
    console.log(`   GET  /health          - Estado del servicio`)
    console.log(`   GET  /version         - Versión del servicio`)
    console.log(`   GET  /status          - Estado completo y diagnóstico`)
    console.log(`   GET  /printers        - Impresoras disponibles`)
    console.log(`   GET  /printer/check   - Verificar si impresora está disponible`)
    console.log(`   GET  /diagnostics     - Diagnóstico completo`)
    console.log('')
    console.log('🎉 ¡Todo listo! Usa tu aplicación Vue normalmente')
    console.log('=' .repeat(50))
  })
}

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  console.log('❌ Error crítico:', error.message)
  console.log('🔄 Reinicia el servicio: npm start')
  process.exit(1)
})

process.on('unhandledRejection', (error) => {
  console.log('❌ Error de promesa:', error.message)
})

// Iniciar servidor
startServer().catch(error => {
  console.log('❌ Error iniciando servidor:', error.message)
  console.log('')
  console.log('🔧 Posibles soluciones:')
  console.log('   • Verifica que no haya otro servicio en el puerto', PORT)
  console.log('   • Ejecuta como administrador si es necesario')
  console.log('   • Verifica que la impresora esté conectada')
  process.exit(1)
})