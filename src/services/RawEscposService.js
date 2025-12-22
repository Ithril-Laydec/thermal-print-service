const fs = require('fs')
const { execSync } = require('child_process')
const path = require('path')
const os = require('os')

// Nombre de la impresora en Windows
const WINDOWS_PRINTER_NAME = 'albaran'

/**
 * Impresión directa con buffer binario ESC/POS
 * El buffer ya viene generado desde el frontend con thermal-printer-encoder
 */
async function printWithRawBuffer(buffer) {
  const platform = process.platform

  if (platform === 'win32') {
    return printWindows(buffer)
  } else {
    return printLinux(buffer)
  }
}

/**
 * Impresión en Windows usando PowerShell y la API de Windows
 */
async function printWindows(buffer) {
  const tempFile = path.join(os.tmpdir(), `thermal-${Date.now()}.bin`)

  try {
    // Escribir buffer a archivo temporal
    fs.writeFileSync(tempFile, buffer)
    console.log(`📄 Archivo temporal: ${tempFile} (${buffer.length} bytes)`)

    // PowerShell script para enviar RAW data a la impresora
    const psScript = `
      $printerName = '${WINDOWS_PRINTER_NAME}'
      $filePath = '${tempFile.replace(/\\/g, '\\\\')}'

      Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;

        public class RawPrinter {
          [StructLayout(LayoutKind.Sequential)]
          public struct DOCINFOA {
            [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
            [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
            [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
          }

          [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
          public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

          [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true)]
          public static extern bool ClosePrinter(IntPtr hPrinter);

          [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
          public static extern bool StartDocPrinter(IntPtr hPrinter, int Level, ref DOCINFOA pDocInfo);

          [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
          public static extern bool EndDocPrinter(IntPtr hPrinter);

          [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
          public static extern bool StartPagePrinter(IntPtr hPrinter);

          [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
          public static extern bool EndPagePrinter(IntPtr hPrinter);

          [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true)]
          public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

          public static bool SendRawData(string printerName, byte[] data) {
            IntPtr hPrinter = IntPtr.Zero;
            DOCINFOA di = new DOCINFOA();
            di.pDocName = "Thermal Ticket";
            di.pDataType = "RAW";

            if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;

            try {
              if (!StartDocPrinter(hPrinter, 1, ref di)) return false;
              if (!StartPagePrinter(hPrinter)) return false;

              int written = 0;
              bool success = WritePrinter(hPrinter, data, data.Length, out written);

              EndPagePrinter(hPrinter);
              EndDocPrinter(hPrinter);

              return success && written == data.Length;
            } finally {
              ClosePrinter(hPrinter);
            }
          }
        }
"@

      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $result = [RawPrinter]::SendRawData($printerName, $bytes)

      if ($result) {
        Write-Output "OK"
      } else {
        throw "Error al enviar datos a la impresora"
      }
    `

    // Ejecutar PowerShell
    const result = execSync(`powershell -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      encoding: 'utf8',
      timeout: 30000
    })

    console.log(`✅ Impresión en Windows: ${WINDOWS_PRINTER_NAME}`)
    return WINDOWS_PRINTER_NAME

  } catch (error) {
    console.error('❌ Error Windows:', error.message)
    throw new Error(`Error imprimiendo en Windows: ${error.message}`)
  } finally {
    // Limpiar archivo temporal
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
    } catch (e) {
      // Ignorar error de limpieza
    }
  }
}

/**
 * Impresión en Linux usando dispositivos /dev/usb/lp*
 */
async function printLinux(buffer) {
  const devices = ['/dev/usb/lp0', '/dev/usb/lp1', '/dev/lp0']
  let lastError = null

  for (const device of devices) {
    try {
      if (!fs.existsSync(device)) continue

      // Verificar permisos
      try {
        fs.accessSync(device, fs.constants.W_OK)
      } catch (err) {
        lastError = `Sin permisos. Ejecuta: sudo chmod 666 ${device}`
        console.log(`❌ ${lastError}`)
        continue
      }

      // Escribir buffer directamente
      fs.writeFileSync(device, buffer)

      console.log(`✅ Impresión en ${device}`)
      return device

    } catch (error) {
      lastError = error.message
      continue
    }
  }

  throw new Error(lastError || 'No se pudo imprimir. Ejecuta: sudo chmod 666 /dev/usb/lp0')
}

module.exports = {
  printWithRawBuffer
}
