const net = require('net')

/**
 * FIFO sender for the SATO WS412 over raw TCP.
 *
 * The SATO reads a job only as fast as it prints it, so waiting for the whole
 * transfer kept the frontend blocked for the physical printing time. Instead:
 * - when the sender is idle, `send()` resolves as soon as the TCP connection
 *   opens (an unreachable printer still fails immediately);
 * - when a job is already transferring, `send()` resolves at once: the job is
 *   queued and sent after the current one.
 * Jobs always go one at a time, in order, over a single connection. Transfer
 * failures after the response are only logged; the user prints again.
 *
 * @param {{ host: string, port: number, timeoutMs?: number,
 *           createConnection?: (options: { host: string, port: number }) => import('net').Socket,
 *           log?: (message: string) => void, logError?: (message: string) => void }} options
 */
function createSatoSender({
	host,
	port,
	timeoutMs = 10000,
	createConnection = net.createConnection,
	log = console.log,
	logError = console.error,
}) {
	const target = `${host}:${port}`
	const queue = []
	let busy = false

	function transfer(buffer, onConnected) {
		return new Promise((resolve, reject) => {
			const socket = createConnection({ host, port })
			let connected = false
			// Idle timeout: no connection or no progress for timeoutMs.
			socket.setTimeout(timeoutMs)

			socket.on('connect', () => {
				connected = true
				onConnected()
				log(`Conectado a SATO ${target} — enviando ${buffer.length} bytes`)
				socket.end(buffer)
			})
			socket.on('timeout', () => {
				socket.destroy(
					new Error(
						connected
							? `Timeout (${timeoutMs / 1000} s) enviando a SATO ${target}`
							: `Timeout (${timeoutMs / 1000} s) conectando a SATO ${target} — verifica que la impresora esté encendida y en red`,
					),
				)
			})
			socket.on('error', (err) => {
				reject(new Error(`Error imprimiendo en SATO (${target}): ${err.message}`))
			})
			socket.on('close', (hadError) => {
				if (!hadError) {
					log(`✅ Impresión SATO enviada a ${target}`)
					resolve()
				}
			})
		})
	}

	async function drain() {
		busy = true
		while (queue.length > 0) {
			const job = queue.shift()
			try {
				await transfer(job.buffer, job.accept)
			} catch (error) {
				logError(error.message)
				job.fail(error)
			}
		}
		busy = false
	}

	/**
	 * @param {Buffer} buffer
	 * @returns {Promise<string>} resolves with the target once the job is accepted
	 */
	function send(buffer) {
		return new Promise((resolve, reject) => {
			const wasBusy = busy
			let settled = false
			const job = {
				buffer,
				accept: () => {
					if (!settled) {
						settled = true
						resolve(target)
					}
				},
				fail: (error) => {
					if (!settled) {
						settled = true
						reject(error)
					}
				},
			}
			queue.push(job)
			if (wasBusy) {
				log(`SATO ocupada: trabajo en cola (${queue.length} pendiente/s)`)
				job.accept()
			} else {
				drain()
			}
		})
	}

	return { send }
}

module.exports = { createSatoSender }
