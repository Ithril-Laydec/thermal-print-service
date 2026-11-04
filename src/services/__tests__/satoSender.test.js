/**
 * Behavior of the SATO FIFO sender: fast acceptance, one connection at a
 * time, in order, and immediate failure when the idle printer is unreachable.
 *
 * Run: node --test src/services/__tests__/satoSender.test.js
 */

'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { createSatoSender } = require('../satoSender')

/** Fake TCP layer: each connection is controlled by the test. */
function fakeNetwork() {
	const connections = []
	function createConnection() {
		const socket = new EventEmitter()
		socket.written = null
		socket.setTimeout = () => {}
		socket.end = (buffer) => {
			socket.written = buffer
		}
		socket.destroy = (error) => {
			if (error) socket.emit('error', error)
			socket.emit('close', Boolean(error))
		}
		connections.push(socket)
		return socket
	}
	return { connections, createConnection }
}

const flush = () => new Promise((resolve) => setImmediate(resolve))

function sender(network) {
	return createSatoSender({
		host: '192.0.2.10',
		port: 9100,
		createConnection: network.createConnection,
		log: () => {},
		logError: () => {},
	})
}

describe('createSatoSender', () => {
	it('accepts an idle job once connected, before the transfer finishes', async () => {
		const network = fakeNetwork()
		const accepted = sender(network).send(Buffer.from('job-1'))

		network.connections[0].emit('connect')

		assert.equal(await accepted, '192.0.2.10:9100')
		assert.equal(network.connections[0].written.toString(), 'job-1')
	})

	it('rejects an idle job when the printer is unreachable', async () => {
		const network = fakeNetwork()
		const accepted = sender(network).send(Buffer.from('job-1'))

		network.connections[0].emit('error', new Error('ECONNREFUSED'))
		network.connections[0].emit('close', true)

		await assert.rejects(accepted)
	})

	it('accepts jobs sent while busy at once and transfers them in order, one at a time', async () => {
		const network = fakeNetwork()
		const sato = sender(network)

		const first = sato.send(Buffer.from('job-1'))
		network.connections[0].emit('connect')
		await first

		await sato.send(Buffer.from('job-2'))
		await sato.send(Buffer.from('job-3'))
		assert.equal(network.connections.length, 1, 'no second connection while the first is open')

		network.connections[0].emit('close', false)
		await flush()
		assert.equal(network.connections.length, 2)
		network.connections[1].emit('connect')
		network.connections[1].emit('close', false)
		await flush()
		network.connections[2].emit('connect')

		assert.deepEqual(
			network.connections.map((socket) => socket.written.toString()),
			['job-1', 'job-2', 'job-3'],
		)
	})

	it('keeps sending queued jobs after a failed transfer', async () => {
		const network = fakeNetwork()
		const sato = sender(network)

		const first = sato.send(Buffer.from('job-1'))
		network.connections[0].emit('connect')
		await first
		await sato.send(Buffer.from('job-2'))

		network.connections[0].emit('error', new Error('ECONNRESET'))
		network.connections[0].emit('close', true)
		await flush()
		network.connections[1].emit('connect')

		assert.equal(network.connections[1].written.toString(), 'job-2')
	})
})
