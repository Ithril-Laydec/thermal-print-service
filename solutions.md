6 Soluciones Técnicas Profundas para Caracteres Especiales

  1. Conversión Explícita con iconv-lite ANTES de enviar (RECOMENDADO)

  Tu código ya tiene iconv-lite pero no lo usa correctamente. La clave es convertir el
  texto UTF-8 → CP858 ANTES de construir los comandos ESC/POS:

  const iconv = require('iconv-lite')

  function printWithProperEncoding(text) {
    // Convertir UTF-8 → CP858 (incluye € y tildes españolas)
    const buffer = iconv.encode(text, 'CP858')

    // Comandos ESC/POS con el buffer YA convertido
    const ESC = '\x1B'
    const GS = '\x1D'

    const header = Buffer.from([
      0x1B, 0x40,        // ESC @ - Reset
      0x1B, 0x74, 0x13,  // ESC t 19 - Select CP858
    ])

    const footer = Buffer.from([
      0x0A, 0x0A,        // Newlines
      0x1D, 0x56, 0x00   // GS V - Cut
    ])

    return Buffer.concat([header, buffer, footer])
  }

  Por qué funciona: Node.js strings son UTF-8. Las impresoras térmicas NO entienden
  UTF-8. Necesitas bytes raw en CP858.

  ---
  2. Comando ESC/POS GS ( C para UTF-8 Nativo (Impresoras Modernas)

  Si tu impresora es Epson TM-T20/T88 o similar fabricada después de 2010, soporta UTF-8
   nativo mediante comandos GS:

  function enableUTF8Mode() {
    // GS ( C - Select UTF-8 character code
    return Buffer.from([
      0x1B, 0x40,              // ESC @ - Initialize
      0x1D, 0x28, 0x43,        // GS ( C
      0x02, 0x00,              // pL, pH (length = 2)
      0x30,                    // fn = 48 (UTF-8)
      0x00                     // m = 0 (disable auto)
    ])
  }

  // Usar ANTES de imprimir
  const initBuffer = enableUTF8Mode()
  const textBuffer = Buffer.from(text, 'utf8')  // Mantener UTF-8
  const fullBuffer = Buffer.concat([initBuffer, textBuffer])

  Verificar compatibilidad: Ejecuta echo -ne "\x1D\x28\x43\x02\x00\x30\x00Test €ñó" > 
  /dev/usb/lp0

  ---
  3. CUPS está Corrompiendo la Codificación - Bypass Total

  CUPS aplica filtros automáticos que convierten todo. Necesitas raw queue sin filtros:

  # Eliminar impresora existente
  lpadmin -x Albaranes

  # Recrear como RAW (sin filtros)
  lpadmin -p Albaranes -v usb://XP/XP-58 -E \
    -o printer-is-shared=false \
    -o raw

  # Deshabilitar TODOS los filtros
  lpadmin -p Albaranes -o document-format-default=application/octet-stream

  Luego en Node.js, envía buffers binarios directamente:

  const { exec } = require('child_process')
  const fs = require('fs')

  const buffer = iconv.encode(text, 'CP858')
  fs.writeFileSync('/tmp/ticket.bin', buffer)
  exec('lpr -P Albaranes -o raw /tmp/ticket.bin')

  ---
  4. Tabla de Transcodificación Manual Byte-a-Byte

  Si TODO falla, implementa la conversión manual usando la tabla real de CP850/CP858:

  // Tabla oficial CP858 (0x80-0xFF)
  const CP858_TABLE = {
    0x20AC: 0xD5,  // € → byte 0xD5 en CP858
    0x00E1: 0xA0,  // á → 0xA0
    0x00E9: 0x82,  // é → 0x82
    0x00ED: 0xA1,  // í → 0xA1
    0x00F3: 0xA2,  // ó → 0xA2
    0x00FA: 0xA3,  // ú → 0xA3
    0x00F1: 0xA4,  // ñ → 0xA4
    0x00BF: 0xA8,  // ¿ → 0xA8
    0x00A1: 0xAD,  // ¡ → 0xAD
  }

  function convertToCP858Manual(text) {
    const result = []
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i)
      if (charCode < 128) {
        result.push(charCode)  // ASCII directo
      } else if (CP858_TABLE[charCode]) {
        result.push(CP858_TABLE[charCode])  // Conversión manual
      } else {
        result.push(0x3F)  // ? como fallback
      }
    }
    return Buffer.from(result)
  }

  Ventaja: Control total, cero dependencias de librerías bugueadas.

  ---
  5. Flashear Firmware con Herramienta del Fabricante

  Muchas impresoras térmicas tienen página de códigos configurable en ROM/EEPROM:

  # Para Epson (requiere epson-escpos-tools)
  npm install -g epson-escpos-tools

  # Cambiar página de códigos por defecto a CP858
  escpos-config --codepage CP858 --save-to-rom

  # Para impresoras chinas/genéricas, usar esc-pos-tool
  pip install escpos
  python -m escpos.config --model Generic --codepage CP858 --flash

  Cómo verificar modelo:
  lsusb -v | grep -A 10 "Printer"
  # Buscar: idVendor, idProduct

  Consulta manual de tu impresora (busca "DIP switch" o "Memory switch" para
  configuración de página de códigos).

  ---
  6. Usar Python-escpos (Tiene Mejor Soporte de Encodings)

  Node.js tiene librerías inmaduras para ESC/POS. Python-escpos es el estándar de facto:

  # thermal-print-python.py
  from escpos.printer import Usb
  from escpos import config

  # Conectar a impresora USB
  p = Usb(0x0416, 0x5011)  # Cambia por tu VendorID:ProductID

  # Configurar codificación
  p.charcode('CP858')  # O 'CP850', 'UTF8'

  # Imprimir con caracteres nativos
  p.text("Precio: 15.50€\n")
  p.text("Cliente: José María\n")
  p.cut()

  Llámalo desde Node.js:

  const { spawn } = require('child_process')

  function printWithPython(text) {
    return new Promise((resolve, reject) => {
      const py = spawn('python3', ['thermal-print-python.py', text])
      py.on('close', (code) => code === 0 ? resolve() : reject())
    })
  }

  Instalación:
  pip install python-escpos

  ---
