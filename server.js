const express = require('express')
const cors = require('cors')
const { ThermalPrinter, PrinterTypes, CharacterSet } = require('node-thermal-printer')
const escpos = require('@node-escpos/core')
const USB = require('@node-escpos/usb-adapter')
const iconv = require('iconv-lite')
const { PORT, HOST } = require('./config')
const { exec } = require('child_process')
const { promisify } = require('util')
const AutoSetup = require('./auto-setup')

const execAsync = promisify(exec)
const app = express()

app.use(cors())
app.use(express.json())

// ============================================================================
// HELPER FUNCTIONS - Funciones auxiliares de codificación
// ============================================================================

// Normalizar caracteres Unicode que NO existen en CP858
// CP858 solo tiene 256 caracteres (ASCII + Europa), sin emojis ni Unicode avanzado
function normalizeUnicodeForCP858(text) {
  return text
    // Box drawing / Líneas decorativas
    .replace(/[─═━]/g, '=')   // Líneas horizontales → igual
    .replace(/[│║┃]/g, '|')   // Líneas verticales → pipe
    .replace(/[┌┐└┘├┤┬┴┼]/g, '+')  // Esquinas → plus

    // Bullets / Viñetas
    .replace(/[•●∙◦]/g, '*')  // Bullets → asterisco
    .replace(/[▪▫]/g, '-')    // Cuadrados → guión

    // Checkmarks / Marcas
    .replace(/[✓✔]/g, 'OK')   // Check simple → OK
    .replace(/[✅]/g, '[OK]')  // Emoji check → [OK]
    .replace(/[✗✘]/g, 'X')    // Cross → X
    .replace(/[❌]/g, '[X]')   // Emoji cross → [X]

    // Emojis comunes
    .replace(/[🧪]/g, '[TEST]')
    .replace(/[✨]/g, '*')
    .replace(/[🎉]/g, '!')
    .replace(/[⚠️]/g, '!')
    .replace(/[🔧]/g, '[CONFIG]')
    .replace(/[📄]/g, '[DOC]')

    // Quotes / Comillas
    .replace(/[""]/g, '"')    // Smart quotes → comillas normales
    .replace(/['']/g, "'")    // Smart apostrophes
    .replace(/[«»]/g, '"')    // Comillas angulares

    // Otros símbolos
    .replace(/[…]/g, '...')   // Ellipsis
    .replace(/[—–]/g, '-')    // Em dash, en dash → guión

    // Flechas
    .replace(/[→⇒➜➔]/g, '->')
    .replace(/[←⇐]/g, '<-')
    .replace(/[↑]/g, '^')
    .replace(/[↓]/g, 'v')
}

// Función MEJORADA: Convertir texto UTF-8 → CP858 con iconv-lite
function encodeTextForPrinter(text, encoding = 'CP858') {
  try {
    // Paso 1: Normalizar caracteres Unicode que no existen en CP858
    const normalizedText = normalizeUnicodeForCP858(text)

    // Paso 2: Convertir UTF-8 → CP858 (incluye € y tildes españolas)
    const buffer = iconv.encode(normalizedText, encoding)
    return { buffer, success: true, encoding }
  } catch (error) {
    console.log(`⚠️  Error codificando con ${encoding}:`, error.message)
    // Fallback: convertir manualmente
    const fallbackText = normalizeUnicodeForCP858(text)
      .replace(/€/g, 'EUR')
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/ñ/g, 'n')
      .replace(/[ÁÀÄÂ]/g, 'A')
      .replace(/[ÉÈËÊ]/g, 'E')
      .replace(/[ÍÌÏÎ]/g, 'I')
      .replace(/[ÓÒÖÔ]/g, 'O')
      .replace(/[ÚÙÜÛ]/g, 'U')
      .replace(/Ñ/g, 'N')
      .replace(/¿/g, '?')
      .replace(/¡/g, '!')
    return { buffer: Buffer.from(fallbackText, 'ascii'), success: false, encoding: 'ASCII-fallback' }
  }
}

// ============================================================================
// PRINTER DETECTION & CONFIGURATION
// ============================================================================

// Detectar impresoras térmicas disponibles
async function detectThermalPrinters() {
  try {
    console.log('🔍 Detectando impresoras térmicas...')

    // Detectar impresoras USB
    const { stdout: lsusbOutput } = await execAsync('lsusb')
    console.log('🔌 Dispositivos USB detectados')

    // Detectar impresoras CUPS
    const { stdout: cupsPrinters } = await execAsync('lpstat -p -d 2>/dev/null || echo "No CUPS printers"')
    console.log('🖨️  Impresoras CUPS:', cupsPrinters.trim())

    // Buscar dispositivos serie
    const { stdout: serialDevs } = await execAsync('ls /dev/tty* 2>/dev/null | grep -E "(USB|ACM)" || echo "No serial devices"')
    console.log('📡 Dispositivos serie:', serialDevs.trim())

    return {
      usb: lsusbOutput,
      cups: cupsPrinters,
      serial: serialDevs
    }
  } catch (error) {
    console.log('⚠️  No se pudieron detectar todas las impresoras:', error.message)
    return null
  }
}

// Configurar impresora - versión simple y robusta
async function createPrinter() {
  console.log('🔧 Configurando impresora térmica...')

  // Lista de configuraciones probadas de más específica a más general
  const configs = [
    // Tu configuración específica RAW
    { name: 'Albaranes (RAW)', type: PrinterTypes.EPSON, interface: 'printer:Albaranes' },
    { name: 'ALBARAN (RAW)', type: PrinterTypes.EPSON, interface: 'printer:ALBARAN' },

    // Dispositivos USB directos (bypass CUPS)
    { name: 'USB directo lp0', type: PrinterTypes.EPSON, interface: '/dev/usb/lp0' },
    { name: 'USB directo lp1', type: PrinterTypes.EPSON, interface: '/dev/usb/lp1' },

    // Configuración por defecto del sistema
    { name: 'Auto detectar', type: PrinterTypes.EPSON, interface: 'printer:auto' },

    // Fallback con diferentes tipos
    { name: 'STAR auto', type: PrinterTypes.STAR, interface: 'printer:auto' },
  ]

  for (const config of configs) {
    try {
      console.log(`🧪 Probando: ${config.name} (${config.interface})`)

      const printer = new ThermalPrinter({
        type: config.type,
        interface: config.interface,
        characterSet: CharacterSet.PC850_MULTILINGUAL,
        width: 48,
        removeSpecialCharacters: true,
        lineCharacter: "=",
      })

      // Test básico para verificar funcionamiento
      try {
        printer.clear()
        printer.println('TEST')

        console.log(`✅ Impresora configurada exitosamente: ${config.name}`)
        return printer

      } catch (testError) {
        console.log(`⚠️  Test falló para ${config.name}: ${testError.message}`)
        continue
      }

    } catch (error) {
      console.log(`❌ Falló ${config.name}: ${error.message}`)
      continue
    }
  }

  // Última opción: configuración ultra-básica
  console.log('🔧 Intentando configuración ultra-básica...')
  try {
    const basicPrinter = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: '/dev/usb/lp0',
      characterSet: CharacterSet.PC850_MULTILINGUAL,
      width: 48,
      removeSpecialCharacters: true,
    })

    console.log('✅ Configuración ultra-básica creada')
    return basicPrinter

  } catch (error) {
    throw new Error(`No se pudo configurar ninguna impresora: ${error.message}`)
  }
}

// Función de fallback: impresión directa bypass librería
async function printDirectToDevice(text) {
  console.log('🔧 Usando impresión directa (bypass librería)...')

  const fs = require('fs').promises

  // Codificar texto con iconv-lite a CP858
  const encoded = encodeTextForPrinter(text, 'CP858')
  console.log(`   Codificación: ${encoded.encoding}`)

  // Construir comandos ESC/POS como Buffer binario
  const header = Buffer.from([
    0x1B, 0x40,       // ESC @ - Inicializar
    0x1B, 0x74, 0x13, // ESC t 19 - CP858
    0x1B, 0x61, 0x01, // ESC a 1 - Centrar
    0x1B, 0x45, 0x01  // ESC E 1 - Negrita ON
  ])

  const titleBuffer = iconv.encode('=== TICKET ===\n', 'CP858')

  const formatBuffer = Buffer.from([
    0x1B, 0x45, 0x00, // ESC E 0 - Negrita OFF
    0x1B, 0x61, 0x00, // ESC a 0 - Izquierda
    0x0A              // Newline
  ])

  const footer = Buffer.from([
    0x0A, 0x0A,       // Newlines
    0x1D, 0x56, 0x00  // GS V 0 - Cortar
  ])

  const escPosBuffer = Buffer.concat([
    header,
    titleBuffer,
    formatBuffer,
    encoded.buffer,
    footer
  ])

  // Intentar escribir directamente a dispositivos
  const devices = ['/dev/usb/lp0', '/dev/usb/lp1', '/dev/lp0', '/dev/lp1']

  for (const device of devices) {
    try {
      console.log(`📤 Intentando escribir directamente a ${device}...`)
      await fs.writeFile(device, escPosBuffer)
      console.log(`✅ Impresión directa exitosa en ${device}`)
      return device
    } catch (error) {
      console.log(`❌ Falló ${device}: ${error.message}`)
      continue
    }
  }

  throw new Error('No se pudo acceder a ningún dispositivo de impresión')
}

// Función para configurar página de códigos ESC/POS
function getCodePageCommands() {
  const ESC = '\x1B'
  return [
    ESC + '@',           // Inicializar impresora
    ESC + 't' + '\x13',  // Configurar página de códigos CP850 (Europa - incluye € y tildes)
    // Alternativa: ESC + 't' + '\x10' para CP1252 si CP850 no funciona
  ]
}

// Función para convertir caracteres SOLO si es necesario
function fixSpecialCharacters(text, fallbackMode = false) {
  if (!fallbackMode) {
    // Intentar primero SIN conversión - las impresoras modernas deberían soportar UTF-8/CP850
    return text
  }

  // Solo usar conversiones como último recurso
  const charMap = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
    'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
    'ñ': 'n', 'Ñ': 'N',
    'ü': 'u', 'Ü': 'U',
    '€': 'EUR', // Solo como último recurso
    '°': 'o',
    'ç': 'c', 'Ç': 'C'
  }

  let fixedText = text
  for (const [char, replacement] of Object.entries(charMap)) {
    fixedText = fixedText.replace(new RegExp(char, 'g'), replacement)
  }

  return fixedText
}

// Función de fallback: usar lpr directamente (MÉTODO QUE FUNCIONA)
async function printWithLpr(text) {
  console.log('🔧 Intentando impresión con lpr...')

  const { exec } = require('child_process')
  const { promisify } = require('util')
  const execAsync = promisify(exec)

  // MÉTODO MEJORADO: Usar iconv-lite para conversión real
  const attempts = [
    // Método 1: CP858 con iconv-lite (RECOMENDADO - incluye € y tildes)
    {
      name: 'CP858 con iconv-lite (€ + tildes)',
      encoding: 'CP858',
      useCodePage: '\x13', // ESC t 19 - CP858
      description: '(Conversión real UTF-8 → CP858)'
    },
    // Método 2: CP850 con iconv-lite (tildes, sin €)
    {
      name: 'CP850 con iconv-lite (tildes)',
      encoding: 'CP850',
      useCodePage: '\x13', // ESC t 19 - CP850
      description: '(Conversión real UTF-8 → CP850)'
    },
    // Método 3: ISO-8859-15 con iconv-lite (Latin-9 con €)
    {
      name: 'ISO-8859-15 con iconv-lite',
      encoding: 'ISO-8859-15',
      useCodePage: '\x0F', // ESC t 15 - ISO-8859-15
      description: '(Latin-9 con € nativo)'
    },
    // Método 4: Windows-1252 con iconv-lite
    {
      name: 'Windows-1252 con iconv-lite',
      encoding: 'Windows-1252',
      useCodePage: '\x10', // ESC t 16 - CP1252
      description: '(Windows Latin con €)'
    },
    // Método 5: Conversión manual completa (fallback seguro)
    {
      name: 'Conversión manual ASCII',
      encoding: null, // Usar conversión manual
      useCodePage: false,
      description: '(Fallback manual - SEGURO)'
    }
  ]

  const printers = ['Albaranes', 'ALBARAN', 'auto']

  for (const attempt of attempts) {
    console.log(`🧪 Probando: ${attempt.name}`)

    // Codificar texto según el método
    let textBuffer
    if (attempt.encoding) {
      const encoded = encodeTextForPrinter(text, attempt.encoding)
      textBuffer = encoded.buffer
      console.log(`   Codificación: ${encoded.encoding} (${encoded.success ? 'exitosa' : 'fallback'})`)
    } else {
      // Fallback manual
      textBuffer = encodeTextForPrinter(text, 'ASCII').buffer
    }

    // Construir comandos ESC/POS como Buffer binario
    const header = []

    // Inicializar impresora
    header.push(0x1B, 0x40) // ESC @

    // Configurar página de códigos si se solicita
    if (attempt.useCodePage) {
      header.push(0x1B, 0x74, attempt.useCodePage.charCodeAt(0)) // ESC t [codepage]
    }

    // Formato del ticket
    header.push(0x1B, 0x61, 0x01) // ESC a 1 - Centrar
    header.push(0x1B, 0x45, 0x01) // ESC E 1 - Negrita ON

    const titleBuffer = iconv.encode('=== TICKET ===\n', attempt.encoding || 'ASCII')

    const formatBuffer = Buffer.from([
      0x1B, 0x45, 0x00, // ESC E 0 - Negrita OFF
      0x1B, 0x61, 0x00, // ESC a 0 - Alinear izquierda
      0x0A              // Newline
    ])

    const footer = Buffer.from([
      0x0A, 0x0A,       // Newlines
      0x1B, 0x64, 0x03, // ESC d 3 - Avanzar papel
      0x1D, 0x56, 0x41, 0x03 // GS V A 3 - Cortar papel
    ])

    // Combinar todos los buffers
    const escPosBuffer = Buffer.concat([
      Buffer.from(header),
      titleBuffer,
      formatBuffer,
      textBuffer,
      footer
    ])

    for (const printer of printers) {
      try {
        console.log(`📤 Intentando lpr con impresora ${printer}...`)

        // Crear archivo temporal para enviar comandos ESC/POS como Buffer binario
        const fs = require('fs')
        const path = require('path')
        const tmpFile = path.join(__dirname, 'tmp_ticket.bin')

        // Escribir buffer binario (NO texto)
        fs.writeFileSync(tmpFile, escPosBuffer)

        const command = printer === 'auto'
          ? `lpr -o raw "${tmpFile}"`
          : `lpr -P ${printer} -o raw "${tmpFile}"`

        await execAsync(command)

        // Limpiar archivo temporal
        fs.unlinkSync(tmpFile)

        console.log(`✅ Impresión exitosa con ${printer} usando ${attempt.name}`)
        console.log(`   ${attempt.description}`)
        return `${printer} (${attempt.name})`

      } catch (error) {
        console.log(`❌ Error con ${printer} (${attempt.name}):`, error.message)

        // Limpiar archivo temporal en caso de error
        try {
          const fs = require('fs')
          const path = require('path')
          const tmpFile = path.join(__dirname, 'tmp_ticket.bin')
          if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
        } catch {}
      }
    }
  }

  throw new Error('No se pudo imprimir con lpr en ningún modo')
}

// 🆕 NUEVO MÉTODO: usar @node-escpos/core con CP858 (€ y tildes automáticos)
async function printWithNodeEscpos(text) {
  console.log('🆕 Intentando @node-escpos/core con CP858...')

  // Configuraciones a probar
  const attempts = [
    {
      name: 'CP858 (Euro + tildes españolas)',
      encoding: 'CP858',
      description: '(€ y áéíóúñ automáticos)'
    },
    {
      name: 'CP1252 (Windows Latin)',
      encoding: 'CP1252',
      description: '(Windows con €)'
    },
    {
      name: 'ISO-8859-15 (Latin-9 con €)',
      encoding: 'ISO-8859-15',
      description: '(Euro estándar)'
    },
    {
      name: 'UTF-8',
      encoding: 'UTF-8',
      description: '(Unicode completo)'
    }
  ]

  const printers = ['Albaranes', 'ALBARAN']

  for (const attempt of attempts) {
    console.log(`🧪 Probando: ${attempt.name}`)

    for (const printerName of printers) {
      try {

        // Configurar la impresora con encoding específico
        const device = new USB()
        const options = { encoding: attempt.encoding, width: 48 }
        const printer = new escpos.Printer(device, options)

        // Abrir conexión
        await new Promise((resolve, reject) => {
          device.open((error) => {
            if (error) reject(error)
            else resolve()
          })
        })

        // Imprimir con formato
        printer
          .font('a')
          .align('ct')
          .style('bu')
          .size(1, 1)
          .text('=== TICKET ===')
          .text('')
          .align('lt')
          .style('normal')
          .text(text) // ¡El texto SIN conversión!
          .text('')
          .text('')
          .cut()

        // Cerrar e imprimir
        await new Promise((resolve, reject) => {
          printer.close((error) => {
            if (error) reject(error)
            else resolve()
          })
        })

        console.log(`✅ @node-escpos exitoso con ${printerName} usando ${attempt.name}`)
        console.log(`   ${attempt.description}`)
        return `${printerName} (@node-escpos ${attempt.name})`

      } catch (error) {
        console.log(`❌ Error @node-escpos ${printerName} (${attempt.name}):`, error.message)
      }
    }
  }

  throw new Error('No se pudo imprimir con @node-escpos en ningún modo')
}

// ✅ ENDPOINT CON MÚLTIPLES FALLBACKS
app.post('/print/ticket', async (req, res) => {
  try {
    const { text } = req.body

    if (!text) {
      return res.status(400).json({ error: 'Falta el texto a imprimir' })
    }

    console.log('🖨️  Iniciando impresión...')
    console.log('📄 Texto:', text.substring(0, 50) + (text.length > 50 ? '...' : ''))
    console.log('🔍 Caracteres especiales: € ×' + (text.match(/€/g) || []).length + ', tildes ×' + (text.match(/[áéíóúÁÉÍÓÚñÑ]/g) || []).length)

    let success = false
    let method = ''
    let details = ''

    // MÉTODO 1: Usar @node-escpos/core (NUEVO - MANEJA € Y TILDES AUTOMÁTICAMENTE)
    try {
      console.log('🆕 Método 1: Intentando con @node-escpos/core (€ y tildes automáticos)...')
      const printer = await printWithNodeEscpos(text)
      success = true
      method = '@node-escpos'
      details = `Impresión @node-escpos exitosa con ${printer}`

    } catch (escposError) {
      console.log('❌ Método 1 (@node-escpos) falló:', escposError.message)

      // MÉTODO 2: Usar lpr (EL MÉTODO ANTERIOR QUE FUNCIONABA)
      try {
        console.log('🚀 Método 2: Intentando con lpr (método anterior)...')
        const printer = await printWithLpr(text)
        success = true
        method = 'lpr'
        details = `Impresión lpr exitosa con ${printer}`

      } catch (lprError) {
        console.log('❌ Método 2 (lpr) falló:', lprError.message)

        // MÉTODO 3: Impresión directa a dispositivo
        try {
          console.log('🔧 Método 3: Intentando impresión directa...')
          const device = await printDirectToDevice(text)
          success = true
          method = 'direct-device'
          details = `Impresión directa exitosa en ${device}`

        } catch (directError) {
          console.log('❌ Método 3 falló:', directError.message)

          // MÉTODO 4: Intentar con node-thermal-printer (librería antigua)
          try {
            console.log('🔧 Método 4: Intentando con node-thermal-printer (librería antigua)...')
            const printer = await createPrinter()

            // Corregir caracteres especiales
            const cleanText = fixSpecialCharacters(text)

            printer.clear()
            printer.alignCenter()
            printer.bold(true)
            printer.println('=== TICKET ===')
            printer.bold(false)
            printer.newLine()

            printer.alignLeft()
            const lines = cleanText.split('\n')
            lines.forEach(line => {
              if (line.trim()) {
                printer.println(line.trim())
              } else {
                printer.newLine()
              }
            })

            printer.newLine()
            printer.cut()

            await printer.execute()

            success = true
            method = 'node-thermal-printer'
            details = 'Impresión con librería exitosa'

          } catch (printerError) {
            console.log('❌ Método 4 falló:', printerError.message)
            throw new Error('Todos los métodos de impresión fallaron')
          }
        }
      }
    }

    if (success) {
      console.log(`✅ Ticket impreso correctamente usando: ${method}`)
      res.json({
        success: true,
        message: 'Ticket impreso correctamente',
        method: method,
        details: details,
        timestamp: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('❌ Error al imprimir:', error.message)

    res.status(500).json({
      error: 'Error al imprimir',
      details: error.message,
      suggestions: [
        'Verifica que la impresora esté conectada y encendida',
        'Verifica permisos: sudo chmod 666 /dev/usb/lp0',
        'Verifica CUPS: lpstat -p'
      ]
    })
  }
})

// Endpoint para verificar si el servicio está funcionando
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'thermal-print-service',
    port: PORT,
    timestamp: new Date().toISOString()
  })
})

// Endpoint para listar impresoras disponibles
app.get('/printers', async (req, res) => {
  try {
    console.log('🔍 Solicitada detección de impresoras...')
    const detection = await detectThermalPrinters()

    res.json({
      message: 'Detección de impresoras completada',
      detection: detection,
      availableInterfaces: [
        'printer:auto',
        '/dev/usb/lp0',
        '/dev/usb/lp1',
        'tcp://192.168.1.100:9100'
      ]
    })
  } catch (error) {
    console.error('❌ Error detectando impresoras:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Endpoint de diagnóstico completo
app.get('/diagnostics', async (req, res) => {
  try {
    console.log('🔍 Ejecutando diagnóstico completo...')

    const detection = await detectThermalPrinters()

    // Intentar crear una impresora para verificar configuración
    let printerConfig = null
    let printerError = null

    try {
      await createPrinter()
      printerConfig = 'Configuración exitosa'
    } catch (error) {
      printerError = error.message
    }

    res.json({
      service: 'thermal-print-service',
      status: 'running',
      port: PORT,
      timestamp: new Date().toISOString(),
      detection: detection,
      printerConfiguration: {
        success: !!printerConfig,
        message: printerConfig || printerError
      },
      recommendations: printerError ? [
        'Verifica que la impresora esté conectada y encendida',
        'Ejecuta: npm run install-drivers',
        'Comprueba que existe impresora "ALBARAN" o "Albaranes" en CUPS'
      ] : ['Todo configurado correctamente']
    })
  } catch (error) {
    res.status(500).json({
      error: 'Error en diagnóstico',
      details: error.message
    })
  }
})

async function startServer() {
  console.log('🚀 Iniciando servicio de impresión térmica...')
  console.log('=' .repeat(50))

  // 1. AUTO-SETUP INTELIGENTE 🤖
  // Este proceso detecta y corrige automáticamente:
  // - Instala CUPS si no existe
  // - Detecta si la impresora está mal configurada (PostScript → RAW)
  // - Reconfigura automáticamente para ESC/POS
  // - Aplica permisos de usuario
  // - Reinicia servicios cuando es necesario
  // ¡TUS COMPAÑEROS NO NECESITAN HACER NADA MANUAL!

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
  app.listen(PORT, () => {
    console.log('')
    console.log('✅ Servicio de impresión térmica LISTO')
    console.log(`📡 Servidor ejecutándose en http://${HOST}:${PORT}`)
    console.log(`🔧 Endpoints disponibles:`)
    console.log(`   POST /print/ticket  - Imprimir ticket`)
    console.log(`   GET  /health        - Estado del servicio`)
    console.log(`   GET  /printers      - Impresoras disponibles`)
    console.log(`   GET  /diagnostics   - Diagnóstico completo`)
    console.log('')
    console.log('🎉 ¡Todo listo! Usa tu aplicación Vue normalmente')
    console.log('=' .repeat(50))
  })
}

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  console.log('❌ Error crítico:', error.message)
  console.log('🔄 Reinicia el servicio: bun start')
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