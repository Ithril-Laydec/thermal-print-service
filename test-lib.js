#!/usr/bin/env node

const ThermalPrinter = require('node-thermal-printer').printer;
const Types = require('node-thermal-printer').types;

const printer = new ThermalPrinter({
  type: Types.EPSON,
  interface: '/dev/usb/lp0',
  characterSet: 'PC858_EURO',
  removeSpecialCharacters: false,
  lineCharacter: "-",
  options: {
    timeout: 5000
  }
});

printer.alignCenter();
printer.println('LA PLANCHADORA');
printer.drawLine();
printer.setTextSize(3, 3);
printer.println('ALB-2024-001');
printer.setTextNormal();
printer.drawLine();
printer.alignLeft();
printer.println('Cliente: José María García');
printer.println('Total: 18.50€');

printer.cut();

console.log(printer.getText());
console.log(printer)
// printer.execute()
//   .then(() => console.log('✅ Impreso con node-thermal-printer'))
//   .catch(err => console.error('❌ Error:', err.message));