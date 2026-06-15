const fs = require('fs')
const net = require('net')
const { execFile, execFileSync } = require('child_process')
const path = require('path')
const os = require('os')

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

// Nombres de impresoras en Windows
const WINDOWS_PRINTER_NAME = 'albaran'
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
 * Impresión en Windows usando RawPrint.exe (winspool.drv nativo)
 * - Usa execFile (async, sin cmd.exe) en lugar de execSync para evitar ETIMEDOUT tras idle
 * - Incluye retry automático: si la primera llamada falla (spooler frío), reintenta tras 1s
 */
async function printWindows(buffer) {
	const tempFile = path.join(os.tmpdir(), `thermal-${Date.now()}.bin`)
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
					[WINDOWS_PRINTER_NAME, tempFile],
					{
						encoding: 'utf8',
						timeout: 15000,
						windowsHide: true,
					},
				)
				console.log(
					`Impresion en Windows (intento ${attempt}): ${result.trim()}`,
				)
				return WINDOWS_PRINTER_NAME
			} catch (error) {
				lastError = error
				console.error(
					`Intento ${attempt}/${MAX_RETRIES} falló: ${error.message}`,
				)
				if (attempt < MAX_RETRIES) {
					await new Promise((r) => setTimeout(r, 1000))
				}
			}
		}

		throw new Error(`Error imprimiendo en Windows: ${lastError.message}`)
	} finally {
		try {
			if (fs.existsSync(tempFile)) {
				fs.unlinkSync(tempFile)
			}
		} catch (e) {}
	}
}

/**
 * Impresión en Linux usando dispositivos /dev/usb/lp*
 * Resolución del dispositivo térmico (por prioridad):
 *   (a) /dev/printer/thermal  — symlink udev por VID:PID (STMicro 0483:5743)
 *   (b) primer /dev/usb/lp* que NO sea el dispositivo real de diplodocus
 *   (c) fallback: primer /dev/usb/lp* disponible (comportamiento original)
 */
async function printLinux(buffer) {
	const THERMAL_SYMLINK = '/dev/printer/thermal'
	const DIPLODOCUS_SYMLINK = '/dev/printer/diplodocus'
	const LP_DEVICES = ['/dev/usb/lp0', '/dev/usb/lp1', '/dev/usb/lp2', '/dev/lp0']

	let candidates = []

	if (fs.existsSync(THERMAL_SYMLINK)) {
		// (a) symlink udev térmico — identificación exacta por VID:PID
		candidates = [THERMAL_SYMLINK]
	} else {
		// Resolver el dispositivo real de diplodocus para excluirlo
		let diplodocusReal = null
		if (fs.existsSync(DIPLODOCUS_SYMLINK)) {
			try {
				diplodocusReal = fs.realpathSync(DIPLODOCUS_SYMLINK)
			} catch (e) {
				// No se pudo resolver; no excluimos nada
			}
		}

		// (b) primer lp* que no sea la matricial
		const available = LP_DEVICES.filter((dev) => {
			if (!fs.existsSync(dev)) return false
			if (diplodocusReal !== null) {
				try {
					return fs.realpathSync(dev) !== diplodocusReal
				} catch (e) {
					return true
				}
			}
			return true
		})

		if (available.length > 0) {
			candidates = available
		} else {
			// (c) fallback: comportamiento original (ningún lp* descartable encontrado)
			candidates = LP_DEVICES.filter((dev) => fs.existsSync(dev))
		}
	}

	let lastError = null

	for (const device of candidates) {
		try {
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

	throw new Error(
		lastError ||
			'No se pudo imprimir. Ejecuta: sudo chmod 666 /dev/usb/lp0',
	)
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
	const tempFile = path.join(os.tmpdir(), `print-${Date.now()}.bin`)
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

/**
 * Impresión a SATO WS412 (etiquetas SBPL) por socket TCP.
 * La SATO es una impresora de red — no depende de plataforma ni de CUPS.
 * Punto de entrada del endpoint /print-labels.
 */
async function printToSato(buffer) {
	return printLinuxToSato(buffer)
}

/**
 * Envía el buffer SBPL a la SATO WS412 por socket TCP (red).
 * Todas las plataformas usan este mismo camino — la SATO escucha en
 * SATO_HOST:SATO_PORT con protocolo raw (sin spooler, sin CUPS).
 */
async function printLinuxToSato(buffer) {
	return new Promise((resolve, reject) => {
		const socket = net.createConnection({ host: SATO_HOST, port: SATO_PORT })

		// Timeout de 10 s: si la SATO no responde, destruimos el socket con error
		socket.setTimeout(10000)

		socket.on('connect', () => {
			console.log(
				`Conectado a SATO ${SATO_HOST}:${SATO_PORT} — enviando ${buffer.length} bytes`,
			)
			socket.write(buffer)
			socket.end()
		})

		socket.on('close', (hadError) => {
			if (!hadError) {
				console.log(`✅ Impresión SATO enviada a ${SATO_HOST}:${SATO_PORT}`)
				resolve(`${SATO_HOST}:${SATO_PORT}`)
			}
			// Si hadError=true, 'error' ya llamó a reject — no hacer nada más
		})

		socket.on('timeout', () => {
			socket.destroy(
				new Error(
					`Timeout (10 s) conectando a SATO ${SATO_HOST}:${SATO_PORT} — verifica que la impresora esté encendida y en red`,
				),
			)
		})

		socket.on('error', (err) => {
			console.error(`Error SATO: ${err.message}`)
			reject(
				new Error(
					`Error imprimiendo en SATO (${SATO_HOST}:${SATO_PORT}): ${err.message}`,
				),
			)
		})
	})
}

module.exports = {
	printWithRawBuffer,
	printToDiplodocus,
	printToSato,
}
