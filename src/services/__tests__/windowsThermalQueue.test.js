/**
 * Behavior of the background Windows thermal queue maintenance.
 *
 * Run: node --test src/services/__tests__/windowsThermalQueue.test.js
 */

'use strict'

const { describe, it, mock } = require('node:test')
const assert = require('node:assert/strict')
const {
	parseMaintenanceOutput,
	createMaintenanceScheduler,
} = require('../windowsThermalQueue')

function deferred() {
	let resolve
	const promise = new Promise((r) => {
		resolve = r
	})
	return { promise, resolve }
}

describe('parseMaintenanceOutput', () => {
	it('reads the JSON result after any noise lines', () => {
		const outcome = parseMaintenanceOutput(
			'warning\r\n{"ok":true,"port":"USB005","action":"repointed","previousPort":"USB003","removedJobs":22}\r\n',
		)
		assert.equal(outcome.ok, true)
		assert.equal(outcome.port, 'USB005')
		assert.equal(outcome.removedJobs, 22)
	})

	it('fails when the output contains no JSON result', () => {
		assert.throws(() => parseMaintenanceOutput('Access denied'))
	})
})

describe('createMaintenanceScheduler', () => {
	it('collapses requests made during a pass into one follow-up pass', async () => {
		const gate = deferred()
		let runs = 0
		const scheduler = createMaintenanceScheduler({
			delayMs: 1000,
			run: async () => {
				runs++
				if (runs === 1) await gate.promise
			},
		})

		const first = scheduler.now()
		scheduler.now()
		scheduler.now()
		gate.resolve()
		await first

		assert.equal(runs, 2)
	})

	it('keeps serving requests after a failed pass', async () => {
		const errors = []
		let runs = 0
		const scheduler = createMaintenanceScheduler({
			delayMs: 1000,
			onError: (error) => errors.push(error),
			run: async () => {
				runs++
				if (runs === 1) throw new Error('powershell timeout')
			},
		})

		await scheduler.now()
		await scheduler.now()

		assert.equal(errors.length, 1)
		assert.equal(runs, 2)
	})

	it('runs a single delayed pass after a burst of later() requests', async () => {
		mock.timers.enable({ apis: ['setTimeout'] })
		try {
			let runs = 0
			const scheduler = createMaintenanceScheduler({
				delayMs: 1000,
				run: async () => {
					runs++
				},
			})

			scheduler.later()
			mock.timers.tick(600)
			scheduler.later()
			mock.timers.tick(600)
			assert.equal(runs, 0)

			mock.timers.tick(400)
			await Promise.resolve()
			assert.equal(runs, 1)
		} finally {
			mock.timers.reset()
		}
	})
})
