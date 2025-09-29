const { exec } = require('child_process')
const { promisify } = require('util')
const os = require('os')

const execAsync = promisify(exec)

class AutoSetup {
  constructor() {
    this.platform = os.platform()
    this.isLinux = this.platform === 'linux'
    this.isWindows = this.platform === 'win32'
  }

  async checkAndInstallDrivers() {
    console.log('🔍 Verificando drivers de impresión térmica...')

    try {
      // Verificar si ya está configurado
      if (await this.isPrinterConfigured()) {
        console.log('✅ Drivers ya configurados correctamente')
        return true
      }

      console.log('⚙️  Drivers no encontrados. Instalando automáticamente...')
      return await this.installDrivers()

    } catch (error) {
      console.log('⚠️  Error verificando drivers:', error.message)
      return await this.installDrivers()
    }
  }

  async isPrinterConfigured() {
    if (this.isLinux) {
      try {
        const { stdout } = await execAsync('lpstat -p 2>/dev/null')
        if (stdout.includes('ALBARAN') || stdout.includes('Albaranes')) {

          // Verificar configuración actual
          console.log('🔍 Verificando configuración actual de impresora...')

          try {
            // Verificar el modelo de la impresora
            const { stdout: printerInfo } = await execAsync('lpstat -l -p Albaranes 2>/dev/null || lpstat -l -p ALBARAN 2>/dev/null || echo ""')

            if (printerInfo.includes('PostScript') ||
                printerInfo.includes('DesignJet') ||
                printerInfo.includes('HP') ||
                printerInfo.includes('T920')) {

              console.log('⚠️  Impresora configurada incorrectamente como PostScript/HP')
              console.log('🔧 Reconfigurando automáticamente a RAW para ESC/POS...')

              // Reconfigurar automáticamente
              await this.fixCupsConfiguration()
              return true // Ya está arreglada
            }

            console.log('✅ Impresora ya configurada correctamente como RAW')
            return true
          } catch (checkError) {
            console.log('⚠️  No se pudo verificar configuración, forzando reconfiguración...')
            await this.fixCupsConfiguration()
            return true
          }
        }
        return false
      } catch {
        return false
      }
    }

    if (this.isWindows) {
      try {
        const { stdout } = await execAsync('wmic printer get name')
        return stdout.includes('ALBARAN') || stdout.includes('Albaranes')
      } catch {
        return false
      }
    }

    return false
  }

  async fixCupsConfiguration() {
    try {
      console.log('🗑️  Eliminando configuración PostScript incorrecta...')

      // Eliminar impresoras mal configuradas
      await execAsync('sudo lpadmin -x ALBARAN 2>/dev/null || true')
      await execAsync('sudo lpadmin -x Albaranes 2>/dev/null || true')

      console.log('🖨️  Configurando impresoras como RAW para ESC/POS...')

      // Configurar ALBARAN como RAW
      await execAsync('sudo lpadmin -p ALBARAN -v usb://Unknown/Printer -m raw -E')
      await execAsync('sudo lpoptions -p ALBARAN -o raw')
      await execAsync('sudo cupsenable ALBARAN')
      await execAsync('sudo cupsaccept ALBARAN')

      // Configurar Albaranes como RAW
      await execAsync('sudo lpadmin -p Albaranes -v usb://Unknown/Printer -m raw -E')
      await execAsync('sudo lpoptions -p Albaranes -o raw')
      await execAsync('sudo cupsenable Albaranes')
      await execAsync('sudo cupsaccept Albaranes')

      // Configurar como predeterminada
      await execAsync('sudo lpadmin -d Albaranes')

      console.log('🔄 Reiniciando CUPS para aplicar cambios...')
      await execAsync('sudo systemctl restart cups')

      console.log('✅ Configuración CUPS corregida automáticamente')
      return true

    } catch (error) {
      console.log('❌ Error corrigiendo CUPS:', error.message)
      return false
    }
  }

  async installDrivers() {
    console.log(`🖥️  Sistema detectado: ${this.platform}`)

    if (this.isLinux) {
      return await this.installLinuxDrivers()
    }

    if (this.isWindows) {
      return await this.installWindowsDrivers()
    }

    console.log('⚠️  Sistema no soportado para instalación automática')
    return false
  }

  async installLinuxDrivers() {
    try {
      console.log('🐧 Configurando drivers para Ubuntu/Linux...')

      // Verificar si CUPS está instalado
      try {
        await execAsync('which lpstat')
        console.log('✅ CUPS ya está instalado')
      } catch {
        console.log('📦 Instalando CUPS...')
        console.log('🔐 Solicitando permisos sudo para instalar CUPS...')
        await execAsync('sudo apt update && sudo apt install -y cups cups-client cups-bsd lpr')
        console.log('✅ CUPS instalado')
      }

      // Añadir usuario al grupo lp
      console.log('👥 Configurando permisos de usuario...')
      await execAsync(`sudo usermod -a -G lp $USER`)
      console.log('✅ Usuario añadido al grupo lp')

      // Configurar impresoras RAW (usar función dedicada)
      console.log('🖨️  Configurando impresoras térmicas...')
      await this.fixCupsConfiguration()

      console.log('✅ Instalación Linux completada')
      console.log('💡 Impresoras configuradas para ESC/POS')

      return true

    } catch (error) {
      console.log('❌ Error instalando drivers Linux:', error.message)
      return false
    }
  }

  async installWindowsDrivers() {
    try {
      console.log('🪟 Configurando drivers para Windows...')

      // Verificar permisos de administrador
      try {
        await execAsync('net session >nul 2>&1')
      } catch {
        console.log('⚠️  Se requieren permisos de administrador')
        console.log('   Ejecuta como administrador o configura manualmente')
        return false
      }

      // Instalar impresora genérica como ALBARAN
      console.log('🖨️  Instalando impresora térmica...')
      await execAsync('rundll32 printui.dll,PrintUIEntry /if /b "ALBARAN" /f "%windir%\\inf\\ntprint.inf" /r "nul:" /m "Generic / Text Only"')

      // Instalar también como Albaranes
      await execAsync('rundll32 printui.dll,PrintUIEntry /if /b "Albaranes" /f "%windir%\\inf\\ntprint.inf" /r "nul:" /m "Generic / Text Only"')

      // Configurar como predeterminada
      await execAsync('rundll32 printui.dll,PrintUIEntry /y /n "ALBARAN"')

      console.log('✅ Instalación Windows completada')
      return true

    } catch (error) {
      console.log('❌ Error instalando drivers Windows:', error.message)
      console.log('💡 Sugerencia: Ejecuta como administrador')
      return false
    }
  }

  async checkPrinterConnection() {
    console.log('🔌 Verificando conexión de impresora...')

    if (this.isLinux) {
      try {
        const { stdout } = await execAsync('lsusb')
        if (stdout.toLowerCase().includes('printer') ||
            stdout.toLowerCase().includes('pos') ||
            stdout.toLowerCase().includes('thermal')) {
          console.log('✅ Impresora USB detectada')
          return true
        }
      } catch {}
    }

    console.log('⚠️  No se detectó impresora USB. Asegúrate de que esté conectada y encendida.')
    return false
  }
}

module.exports = AutoSetup