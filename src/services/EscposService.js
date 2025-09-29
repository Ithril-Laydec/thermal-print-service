const escpos = require('@node-escpos/core')
const USB = require('@node-escpos/usb-adapter')

/**
 * Usar @node-escpos/core con CP858 (€ y tildes automáticos)
 */
async function printWithNodeEscpos(text) {
  const attempts = [
    { name: 'CP858', encoding: 'CP858' },
    { name: 'CP1252', encoding: 'CP1252' },
    { name: 'ISO-8859-15', encoding: 'ISO-8859-15' }
  ]

  const printers = ['Albaranes', 'ALBARAN']

  for (const attempt of attempts) {
    for (const printerName of printers) {
      try {
        const device = new USB()
        const options = { encoding: attempt.encoding, width: 48 }
        const printer = new escpos.Printer(device, options)

        await new Promise((resolve, reject) => {
          device.open((error) => {
            if (error) reject(error)
            else resolve()
          })
        })

        // Procesar el texto línea por línea con marcadores de formato
        const lines = text.split('\n')

        printer.font('a').align('lt')

        for (const line of lines) {
          // Detectar marcadores de formato
          if (line.includes('[LARGE]') && line.includes('[BOLD]')) {
            const cleanLine = line.replace(/\[LARGE\]|\[\/LARGE\]|\[BOLD\]|\[\/BOLD\]/g, '')
            printer.style('bold').size(2, 2).text(cleanLine).style('normal').size(1, 1)
          } else if (line.includes('[LARGE]')) {
            const cleanLine = line.replace(/\[LARGE\]|\[\/LARGE\]/g, '')
            printer.size(2, 2).text(cleanLine).size(1, 1)
          } else if (line.includes('[BOLD]')) {
            const cleanLine = line.replace(/\[BOLD\]|\[\/BOLD\]/g, '')
            printer.style('bold').text(cleanLine).style('normal')
          } else {
            printer.text(line)
          }
        }

        printer.text('').text('').cut()

        await new Promise((resolve, reject) => {
          printer.close((error) => {
            if (error) reject(error)
            else resolve()
          })
        })

        console.log(`✅ Impresión exitosa: ${printerName} (@node-escpos ${attempt.name})`)
        return `${printerName} (@node-escpos ${attempt.name})`

      } catch (error) {
        continue
      }
    }
  }

  throw new Error('No se pudo imprimir con @node-escpos')
}

module.exports = {
  printWithNodeEscpos
}