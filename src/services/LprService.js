const { execAsync } = require('../utils/system')
const { encodeTextForPrinter } = require('../utils/encoding')
const iconv = require('iconv-lite')

/**
 * Función de fallback: usar lpr directamente (MÉTODO QUE FUNCIONA)
 */
async function printWithLpr(text) {
  const { exec } = require('child_process')
  const { promisify } = require('util')
  const execAsync = promisify(exec)

  const attempts = [
    {
      name: 'CP858',
      encoding: 'CP858',
      useCodePage: '\x13'
    },
    {
      name: 'CP850',
      encoding: 'CP850',
      useCodePage: '\x13'
    },
    {
      name: 'ISO-8859-15',
      encoding: 'ISO-8859-15',
      useCodePage: '\x0F'
    }
  ]

  const printers = ['Albaranes', 'ALBARAN', 'auto']

  for (const attempt of attempts) {
    const textBuffer = encodeTextForPrinter(text, attempt.encoding).buffer

    const header = []
    header.push(0x1B, 0x40)
    if (attempt.useCodePage) {
      header.push(0x1B, 0x74, attempt.useCodePage.charCodeAt(0))
    }
    header.push(0x1B, 0x61, 0x01)
    header.push(0x1B, 0x45, 0x01)

    const titleBuffer = iconv.encode('=== TICKET ===\n', attempt.encoding)
    const formatBuffer = Buffer.from([0x1B, 0x45, 0x00, 0x1B, 0x61, 0x00, 0x0A])
    const footer = Buffer.from([0x0A, 0x0A, 0x1B, 0x64, 0x03, 0x1D, 0x56, 0x41, 0x03])

    const escPosBuffer = Buffer.concat([
      Buffer.from(header),
      titleBuffer,
      formatBuffer,
      textBuffer,
      footer
    ])

    for (const printer of printers) {
      try {
        const fs = require('fs')
        const path = require('path')
        const tmpFile = path.join(__dirname, '../../tmp_ticket.bin')

        fs.writeFileSync(tmpFile, escPosBuffer)

        const command = printer === 'auto'
          ? `lpr -o raw "${tmpFile}"`
          : `lpr -P ${printer} -o raw "${tmpFile}"`

        await execAsync(command)
        fs.unlinkSync(tmpFile)

        console.log(`✅ Impresión exitosa: ${printer} (${attempt.name})`)
        return `${printer} (${attempt.name})`

      } catch (error) {
        try {
          const fs = require('fs')
          const path = require('path')
          const tmpFile = path.join(__dirname, '../../tmp_ticket.bin')
          if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
        } catch {}
      }
    }
  }

  throw new Error('No se pudo imprimir con lpr')
}

module.exports = {
  printWithLpr
}