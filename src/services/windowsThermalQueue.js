const path = require('path')
const { execFile } = require('child_process')

/**
 * Impresión térmica en Windows resistente a cambios de puerto USB.
 *
 * Windows asigna un puerto virtual nuevo (USB003 → USB005...) cuando la térmica
 * se conecta a otra toma USB, y la cola `albaran` se queda apuntando al puerto
 * antiguo: el spooler acepta los trabajos pero nunca los imprime. El script
 * `installers/bin/print-thermal.ps1` identifica la térmica por VID/PID, corrige
 * la cola si hace falta y confirma que el trabajo ha salido de la cola.
 */

const WINDOWS_THERMAL_PRINTER = 'albaran'
const BIN_DIR = path.join(__dirname, '..', '..', 'installers', 'bin')
const SCRIPT_PATH = path.join(BIN_DIR, 'print-thermal.ps1')
const RAWPRINT_PATH = path.join(BIN_DIR, 'RawPrint.exe')
const SCRIPT_TIMEOUT_MS = 45000

const FAILURE_MESSAGES = {
	THERMAL_NOT_CONNECTED:
		'Impresora térmica no detectada. Comprueba que está encendida y conectada por USB.',
	THERMAL_AMBIGUOUS:
		'Hay más de una impresora térmica conectada; deja conectada solo una.',
	PORT_MISSING:
		'Windows no ha creado el puerto USB de la impresora térmica. Desconéctala y vuelve a conectarla.',
	RAWPRINT_FAILED: 'Windows no ha aceptado el ticket en la cola de impresión.',
	NOT_PRINTED:
		'La impresora térmica no ha impreso el ticket (¿sin papel, tapa abierta o apagada?). Se ha cancelado para que no salga más tarde; vuelve a imprimir.',
	SCRIPT_ERROR: 'Error preparando la impresora térmica.',
}

/**
 * Convierte la línea JSON del script en el nombre de la cola o en un Error.
 * @param {string} stdout
 * @returns {{ printer: string, port: string, action: string, previousPort: string, removedJobs: number }}
 */
function interpretThermalScriptOutput(stdout) {
	const line = String(stdout)
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.startsWith('{'))
		.pop()

	let result
	try {
		result = JSON.parse(line)
	} catch {
		throw new Error(
			`Respuesta no válida del script de impresión térmica: ${String(stdout).slice(0, 200)}`,
		)
	}

	if (!result.ok) {
		const base = FAILURE_MESSAGES[result.code] || 'Error imprimiendo en la térmica.'
		const error = new Error(result.detail ? `${base} (${result.detail})` : base)
		error.code = result.code || 'UNKNOWN'
		throw error
	}

	return {
		printer: result.printer,
		port: result.port,
		action: result.action,
		previousPort: result.previousPort,
		removedJobs: result.removedJobs,
	}
}

/**
 * Ejecuta las tareas de una en una. La verificación de vaciado de cola del
 * script vería los trabajos de otra impresión concurrente como "atascados".
 */
function createSerialQueue() {
	let tail = Promise.resolve()
	return function serialize(task) {
		const run = tail.then(task, task)
		tail = run.catch(() => {})
		return run
	}
}

const serialize = createSerialQueue()

function runScript(args) {
	return new Promise((resolve, reject) => {
		execFile(
			'powershell.exe',
			[
				'-NoProfile',
				'-NonInteractive',
				'-ExecutionPolicy',
				'Bypass',
				'-File',
				SCRIPT_PATH,
				'-PrinterName',
				WINDOWS_THERMAL_PRINTER,
				...args,
			],
			{ encoding: 'utf8', timeout: SCRIPT_TIMEOUT_MS, windowsHide: true },
			(error, stdout, stderr) => {
				if (error) {
					reject(
						new Error(
							`Error ejecutando el script de impresión térmica: ${error.message} ${stderr || ''}`.trim(),
						),
					)
					return
				}
				resolve(stdout)
			},
		)
	})
}

function logQueueRepair(outcome) {
	if (outcome.action === 'none') return
	const moved = outcome.previousPort ? ` ${outcome.previousPort} → ${outcome.port}` : ` en ${outcome.port}`
	console.log(
		`🔧 Cola ${outcome.printer} corregida (${outcome.action})${moved}; ${outcome.removedJobs} trabajos atascados eliminados`,
	)
}

/**
 * Asegura que la cola apunta a la térmica conectada, sin imprimir.
 * Lo usan el instalador y el keepalive periódico.
 */
function ensureWindowsThermalQueue() {
	return serialize(async () => {
		const outcome = interpretThermalScriptOutput(await runScript([]))
		logQueueRepair(outcome)
		return outcome
	})
}

/**
 * Imprime un fichero RAW en la térmica y espera a que salga de la cola.
 * @param {string} filePath
 * @returns {Promise<string>} nombre de la cola usada
 */
function printWindowsThermalFile(filePath) {
	return serialize(async () => {
		const outcome = interpretThermalScriptOutput(
			await runScript(['-File', filePath, '-RawPrintExe', RAWPRINT_PATH]),
		)
		logQueueRepair(outcome)
		console.log(`Impresión térmica entregada en ${outcome.printer} (${outcome.port})`)
		return outcome.printer
	})
}

module.exports = {
	WINDOWS_THERMAL_PRINTER,
	ensureWindowsThermalQueue,
	printWindowsThermalFile,
	// Exportados para tests
	interpretThermalScriptOutput,
	createSerialQueue,
}
