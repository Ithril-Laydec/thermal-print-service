const fs = require('fs')
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
const WINDOWS_SATO_NAMES = ['SATO WS412', 'ETIQUETADORA', 'Etiquetas']

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

// Caché de impresora SATO para evitar llamadas repetidas a wmic
let cachedSatoPrinter = null

/**
 * Busca la primera impresora disponible entre los nombres dados (Windows)
 * Usa execFileSync con wmic directamente (sin cmd.exe) para evitar timeouts
 * Cachea el resultado para evitar procesos zombie por timeouts
 */
function findWindowsPrinter(names) {
	// Retornar caché si existe
	if (cachedSatoPrinter) {
		return cachedSatoPrinter
	}

	try {
		const result = execFileSync('wmic', ['printer', 'get', 'name'], {
			encoding: 'utf8',
			timeout: 10000,
			windowsHide: true,
		})
		// wmic output: primera línea es "Name", resto son nombres con espacios trailing
		const installed = result
			.split('\n')
			.slice(1)
			.map((p) => p.trim())
			.filter(Boolean)
		const found = names.find((name) => installed.includes(name))
		if (found) {
			cachedSatoPrinter = found
			console.log(`Impresora SATO cacheada: ${found}`)
		}
		return found
	} catch (error) {
		console.error('Error buscando impresoras:', error.message)
		return null
	}
}

/**
 * Impresión a SATO WS412 (etiquetas SBPL)
 * Usa CUPS en Linux, RawPrint en Windows
 */
async function printToSato(buffer) {
	const platform = process.platform

	if (platform === 'win32') {
		const printerName = findWindowsPrinter(WINDOWS_SATO_NAMES)
		if (!printerName) {
			throw new Error(
				`No se encontró impresora SATO. Nombres buscados: ${WINDOWS_SATO_NAMES.join(', ')}`,
			)
		}
		console.log(`Impresora SATO encontrada: ${printerName}`)
		return printWindowsToPrinter(buffer, printerName)
	} else {
		return printLinuxToSato(buffer)
	}
}

/**
 * Impresión a SATO en Linux usando CUPS
 */
async function printLinuxToSato(buffer) {
	const tempFile = path.join(os.tmpdir(), `sato-${Date.now()}.bin`)
	const cupsQueue = 'Albaranes'

	try {
		fs.writeFileSync(tempFile, buffer)
		console.log(
			`Archivo temporal SATO: ${tempFile} (${buffer.length} bytes)`,
		)

		execFileSync('lp', ['-d', cupsQueue, '-o', 'raw', tempFile], {
			encoding: 'utf8',
			timeout: 30000,
		})

		console.log(`✅ Impresión SATO en cola ${cupsQueue}`)
		return cupsQueue
	} catch (error) {
		console.error('Error SATO:', error.message)
		throw new Error(`Error imprimiendo en SATO: ${error.message}`)
	} finally {
		try {
			if (fs.existsSync(tempFile)) {
				fs.unlinkSync(tempFile)
			}
		} catch (e) {}
	}
}

module.exports = {
	printWithRawBuffer,
	printToDiplodocus,
	printToSato,
}
