#!/usr/bin/env node

const os = require('os')
const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

async function installDrivers() {
  const platform = os.platform()

  console.log('🖨️  Instalador automático de drivers térmicos')
  console.log(`🖥️  Sistema detectado: ${platform}`)
  console.log('=' .repeat(50))

  try {
    if (platform === 'linux') {
      console.log('🐧 Ejecutando instalación para Ubuntu/Linux...')
      await execAsync('chmod +x install-ubuntu.sh')
      await execAsync('./install-ubuntu.sh')

    } else if (platform === 'win32') {
      console.log('🪟 Ejecutando instalación para Windows...')
      console.log('⚠️  IMPORTANTE: Ejecuta este programa como Administrador')
      await execAsync('install-windows.bat')

    } else if (platform === 'darwin') {
      console.log('🍎 macOS detectado')
      console.log('💡 Para macOS:')
      console.log('   1. Conecta la impresora térmica por USB')
      console.log('   2. Ve a Preferencias del Sistema → Impresoras y Escáneres')
      console.log('   3. Añade la impresora con nombre "ALBARAN"')
      console.log('   4. Selecciona driver "Generic PostScript Printer"')

    } else {
      console.log(`❓ Sistema no soportado: ${platform}`)
      console.log('💡 Configuración manual necesaria')
    }

    console.log('')
    console.log('✅ Proceso completado!')
    console.log('🔄 Ahora ejecuta: bun start')

  } catch (error) {
    console.error('❌ Error durante la instalación:', error.message)
    console.log('')
    console.log('🔧 Instalación manual necesaria:')
    console.log('   Ubuntu: sudo bash install-ubuntu.sh')
    console.log('   Windows: Ejecutar install-windows.bat como administrador')
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  installDrivers()
}

module.exports = { installDrivers }