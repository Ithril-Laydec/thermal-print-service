const path = require('path')
const { execFile } = require('child_process')

/**
 * Background maintenance of the Windows thermal queue (`albaran`).
 *
 * Tickets are sent straight to the queue with RawPrint.exe and the HTTP
 * response returns as soon as the spooler accepts them: nothing on the print
 * path waits for PowerShell, the USB scan or the physical printing.
 *
 * Moving the thermal printer to another USB socket gives it a new virtual port
 * and leaves `albaran` on the old port, offline: the spooler accepts tickets
 * that never print. `installers/bin/print-thermal.ps1` repairs that, so it runs
 * in the background right after each print, again once a just-sent ticket
 * would count as stuck, at startup and periodically. The first ticket after a
 * port change is lost; the second click prints.
 */

const WINDOWS_THERMAL_PRINTER = 'albaran'
const SCRIPT_PATH = path.join(__dirname, '..', '..', 'installers', 'bin', 'print-thermal.ps1')
const SCRIPT_TIMEOUT_MS = 60000
// A ticket still queued after this long is stuck (printer off, no paper...).
const STUCK_AFTER_SECONDS = 60
// Follow-up pass after a print, once that ticket would count as stuck.
const STUCK_CHECK_DELAY_MS = (STUCK_AFTER_SECONDS + 5) * 1000

/**
 * Parses the script's JSON line.
 * @param {string} stdout
 * @returns {{ ok: boolean, code: string, printer: string, port: string, action: string, previousPort: string, removedJobs: number, detail: string }}
 */
function parseMaintenanceOutput(stdout) {
	const line = String(stdout)
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.startsWith('{'))
		.pop()
	try {
		return JSON.parse(line)
	} catch {
		throw new Error(
			`Respuesta no válida del mantenimiento de la cola térmica: ${String(stdout).slice(0, 200)}`,
		)
	}
}

/**
 * Coalescing scheduler: never runs two passes at once; requests that arrive
 * while a pass is running collapse into a single follow-up pass. `later()`
 * (re)arms one delayed pass, so a burst of prints yields one delayed check.
 *
 * @param {{ run: () => Promise<unknown>, delayMs: number, onError?: (error: Error) => void }} options
 */
function createMaintenanceScheduler({ run, delayMs, onError = () => {} }) {
	let running = null
	let rerun = false
	let timer = null

	function now() {
		if (running) {
			rerun = true
			return running
		}
		running = (async () => {
			try {
				do {
					rerun = false
					try {
						await run()
					} catch (error) {
						onError(error)
					}
				} while (rerun)
			} finally {
				running = null
			}
		})()
		return running
	}

	function later() {
		if (timer) clearTimeout(timer)
		timer = setTimeout(() => {
			timer = null
			now()
		}, delayMs)
		if (typeof timer.unref === 'function') timer.unref()
	}

	return { now, later }
}

function runMaintenanceScript() {
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
				'-StuckAfterSeconds',
				String(STUCK_AFTER_SECONDS),
			],
			{ encoding: 'utf8', timeout: SCRIPT_TIMEOUT_MS, windowsHide: true },
			(error, stdout, stderr) => {
				if (error) {
					reject(new Error(`${error.message} ${stderr || ''}`.trim()))
					return
				}
				resolve(stdout)
			},
		)
	})
}

async function maintainOnce() {
	const outcome = parseMaintenanceOutput(await runMaintenanceScript())
	if (!outcome.ok) {
		// Not connected is normal on a workstation without a thermal printer.
		if (outcome.code !== 'THERMAL_NOT_CONNECTED') {
			console.error(`⚠️  Cola térmica no verificada: ${outcome.code} ${outcome.detail || ''}`)
		}
		return outcome
	}
	if (outcome.action !== 'none') {
		const moved = outcome.previousPort ? ` ${outcome.previousPort} → ${outcome.port}` : ` en ${outcome.port}`
		console.log(
			`🔧 Cola ${outcome.printer} corregida (${outcome.action})${moved}; ${outcome.removedJobs} trabajos retenidos eliminados`,
		)
	}
	return outcome
}

const scheduler = createMaintenanceScheduler({
	run: maintainOnce,
	delayMs: STUCK_CHECK_DELAY_MS,
	onError: (error) => console.error(`⚠️  Mantenimiento de la cola térmica falló: ${error.message}`),
})

/** Startup and keepalive: repair the queue now, in the background. */
function maintainWindowsThermalQueue() {
	return scheduler.now()
}

/** After every thermal print attempt (success or failure). Never awaited. */
function scheduleThermalMaintenanceAfterPrint() {
	scheduler.now()
	scheduler.later()
}

module.exports = {
	WINDOWS_THERMAL_PRINTER,
	maintainWindowsThermalQueue,
	scheduleThermalMaintenanceAfterPrint,
	// Exported for tests
	parseMaintenanceOutput,
	createMaintenanceScheduler,
}
