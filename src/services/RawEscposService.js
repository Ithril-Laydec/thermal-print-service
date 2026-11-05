const fs = require('fs')
const { execFile } = require('child_process')
const path = require('path')
const os = require('os')
const crypto = require('crypto')

/**
 * Wrapper async de execFile para evitar execSync (que bloquea el event loop)
 * y evitar cmd.exe (que causa ETIMEDOUT tras idle en Windows)
 */
function execFileAsync(file, args, options) {
	return new Promise((resolve, reject) => {
		execFile(file, args, options, (error, stdout, stderr) => {
			if (error) {
				error.stderr = stderr
				reject(error)
			} else {
				resolve(stdout)
			}
		})
	})
}

const {
	WINDOWS_THERMAL_PRINTER,
	scheduleThermalMaintenanceAfterPrint,
} = require('./windowsThermalQueue')
const { createSatoSender } = require('./satoSender')

// Nombres de impresoras en Windows
const WINDOWS_PRINTER_DIPLODOCUS = 'diplodocus'

// Impresora de etiquetas SATO WS412 — conexión directa por red (TCP/IP raw)
// Si la SATO cambia de dirección IP o puerto, editar SOLO estas dos constantes:
const SATO_HOST = '192.168.0.251'
const SATO_PORT = 9100

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
 * Impresión térmica en Windows: camino rápido.
 * Envía el ticket directamente a la cola `albaran` (mismo camino que la
 * diplodocus) y responde en cuanto el spooler lo acepta. El mantenimiento de la
 * cola (puerto USB, modo sin conexión, trabajos atascados) se ejecuta después en
 * segundo plano, haya ido bien o mal, para que un segundo clic ya imprima.
 */
async function printWindows(buffer) {
	try {
		return await printWindowsToPrinter(buffer, WINDOWS_THERMAL_PRINTER)
	} finally {
		scheduleThermalMaintenanceAfterPrint()
	}
}

/**
 * Resuelve el dispositivo Linux para la impresora térmica.
 *
 * INVARIANTE DE SEGURIDAD: NUNCA devuelve un /dev/usb/lp* sin verificar identidad.
 * Solo se acepta el symlink udev /dev/printer/thermal (VID:PID 0483:5743 o 0fe6:811e).
 * Si el symlink no está disponible, lanza Error con mensaje accionable en lugar de
 * adivinar entre candidatos — evita escribir ESC/POS a la HP LaserJet 1320 (lp2).
 *
 * @param {{ existsFn?: (path: string) => boolean }} opts - inyección de dependencias (para tests)
 * @returns {string} ruta del dispositivo verificado
 * @throws {Error} si no se puede resolver el dispositivo de forma segura
 */
function resolveLinuxThermalDevice({ existsFn = fs.existsSync } = {}) {
	const THERMAL_SYMLINK = '/dev/printer/thermal'

	if (existsFn(THERMAL_SYMLINK)) {
		return THERMAL_SYMLINK
	}

	throw new Error(
		'Impresora térmica no encontrada: falta /dev/printer/thermal. ' +
		'Verifica conexión USB y ejecuta: sudo udevadm trigger',
	)
}

/**
 * Impresión en Linux usando el symlink udev verificado.
 * Delega la resolución del device a resolveLinuxThermalDevice(), que garantiza
 * que NUNCA se escribe a un device no identificado (p.ej. la HP LaserJet 1320).
 */
async function printLinux(buffer) {
	const device = resolveLinuxThermalDevice()

	try {
		fs.accessSync(device, fs.constants.W_OK)
	} catch (err) {
		throw new Error(`Sin permisos en ${device}. Ejecuta: sudo chmod 666 ${device}`)
	}

	fs.writeFileSync(device, buffer)
	console.log(`✅ Impresión en ${device}`)
	return device
}

/**
 * Impresión a diplodocus (EPSON LQ-590 matricial)
 * Acepta buffer binario ESC/P2 o texto plano
 */
async function printToDiplodocus(buffer) {
	const platform = process.platform

	if (platform === 'win32') {
		return printWindowsToPrinter(buffer, WINDOWS_PRINTER_DIPLODOCUS)
	} else {
		return printLinuxToDiplodocus(buffer)
	}
}

/**
 * Impresión a diplodocus en Linux usando symlink udev
 */
async function printLinuxToDiplodocus(buffer) {
	const device = '/dev/printer/diplodocus'

	if (!fs.existsSync(device)) {
		throw new Error(
			'Diplodocus no conectada. Verifica conexión USB y ejecuta: sudo udevadm trigger',
		)
	}

	try {
		fs.accessSync(device, fs.constants.W_OK)
	} catch (err) {
		throw new Error(
			`Sin permisos en ${device}. Ejecuta: sudo chmod 666 ${device}`,
		)
	}

	fs.writeFileSync(device, buffer)
	console.log(`✅ Impresión en ${device}`)
	return device
}

/**
 * Impresión genérica en Windows a cualquier impresora
 * - Usa execFile (async, sin cmd.exe) con retry automático
 */
async function printWindowsToPrinter(buffer, printerName) {
	const tempFile = path.join(
		os.tmpdir(),
		`print-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.bin`,
	)
	const rawPrintExe = path.join(
		__dirname,
		'..',
		'..',
		'installers',
		'bin',
		'RawPrint.exe',
	)
	const MAX_RETRIES = 2

	try {
		fs.writeFileSync(tempFile, buffer)
		console.log(`Archivo temporal: ${tempFile} (${buffer.length} bytes)`)

		let lastError
		for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
			try {
				const result = await execFileAsync(
					rawPrintExe,
					[printerName, tempFile],
					{
						encoding: 'utf8',
						timeout: 15000,
						windowsHide: true,
					},
				)
				console.log(
					`Impresion en ${printerName} (intento ${attempt}): ${result.trim()}`,
				)
				return printerName
			} catch (error) {
				lastError = error
				console.error(
					`Intento ${attempt}/${MAX_RETRIES} en ${printerName} falló: ${error.message}`,
				)
				if (attempt < MAX_RETRIES) {
					await new Promise((r) => setTimeout(r, 1000))
				}
			}
		}

		throw new Error(
			`Error imprimiendo en ${printerName}: ${lastError.message}`,
		)
	} finally {
		try {
			if (fs.existsSync(tempFile)) {
				fs.unlinkSync(tempFile)
			}
		} catch (e) {}
	}
}

const satoSender = createSatoSender({ host: SATO_HOST, port: SATO_PORT })

/**
 * Impresión a SATO WS412 (etiquetas SBPL) por socket TCP.
 * La SATO es una impresora de red — no depende de plataforma ni de CUPS.
 * Punto de entrada del endpoint /print-labels. Responde en cuanto el trabajo
 * está aceptado, sin esperar a que la SATO lo reciba entero (ver satoSender.js).
 */
async function printToSato(buffer) {
	return satoSender.send(buffer)
}

module.exports = {
	printWithRawBuffer,
	printToDiplodocus,
	printToSato,
	// Exportado para tests unitarios y diagnóstico externo
	resolveLinuxThermalDevice,
}
