const { ThermalPrinter, PrinterTypes, CharacterSet } = require('node-thermal-printer')
const { encodeTextForPrinter, fixSpecialCharacters } = require('../utils/encoding')

/**
 * Configurar impresora - versión simple y robusta
 */
async function createPrinter() {
  const configs = [
    { name: 'Albaranes', type: PrinterTypes.EPSON, interface: 'printer:Albaranes' },
    { name: 'ALBARAN', type: PrinterTypes.EPSON, interface: 'printer:ALBARAN' },
    { name: 'USB lp0', type: PrinterTypes.EPSON, interface: '/dev/usb/lp0' },
    { name: 'USB lp1', type: PrinterTypes.EPSON, interface: '/dev/usb/lp1' },
    { name: 'Auto', type: PrinterTypes.EPSON, interface: 'printer:auto' }
  ]

  for (const config of configs) {
    try {
      const printer = new ThermalPrinter({
        type: config.type,
        interface: config.interface,
        characterSet: CharacterSet.PC850_MULTILINGUAL,
        width: 48,
        removeSpecialCharacters: true,
        lineCharacter: "=",
      })

      printer.clear()
      printer.println('TEST')
      console.log(`✅ Impresora configurada: ${config.name}`)
      return printer

    } catch (error) {
      continue
    }
  }

  throw new Error('No se pudo configurar ninguna impresora')
}

/**
 * Imprimir con node-thermal-printer (método 4)
 */
async function printWithThermalPrinter(text) {
  const printer = await createPrinter()
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
  return 'node-thermal-printer'
}

module.exports = {
  createPrinter,
  printWithThermalPrinter
}