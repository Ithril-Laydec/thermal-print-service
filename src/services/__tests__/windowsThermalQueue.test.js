/**
 * Behavior of the Windows thermal queue guard (Node side).
 *
 * The PowerShell script reports one JSON line; Node must only report success
 * when the script confirms delivery, and must never run two thermal jobs at
 * once (the script's drain check would treat the other job as stuck).
 *
 * Run: node --test src/services/__tests__/windowsThermalQueue.test.js
 */

'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
	interpretThermalScriptOutput,
	createSerialQueue,
} = require('../windowsThermalQueue')

function scriptLine(fields) {
	return JSON.stringify({
		ok: false,
		code: '',
		printer: 'albaran',
		port: '',
		action: 'none',
		previousPort: '',
		removedJobs: 0,
		detail: '',
		...fields,
	})
}

describe('interpretThermalScriptOutput', () => {
	it('returns the repaired queue when the script repointed it and printed', () => {
		const outcome = interpretThermalScriptOutput(
			scriptLine({
				ok: true,
				port: 'USB005',
				action: 'repointed',
				previousPort: 'USB003',
				removedJobs: 22,
			}),
		)
		assert.deepEqual(outcome, {
			printer: 'albaran',
			port: 'USB005',
			action: 'repointed',
			previousPort: 'USB003',
			removedJobs: 22,
		})
	})

	it('ignores noise printed before the JSON line', () => {
		const stdout = `warning line\r\n${scriptLine({ ok: true, port: 'USB001' })}\r\n`
		assert.equal(interpretThermalScriptOutput(stdout).port, 'USB001')
	})

	for (const code of [
		'THERMAL_NOT_CONNECTED',
		'THERMAL_AMBIGUOUS',
		'PORT_MISSING',
		'RAWPRINT_FAILED',
		'NOT_PRINTED',
		'SCRIPT_ERROR',
	]) {
		it(`fails with code ${code} instead of reporting a print`, () => {
			assert.throws(
				() => interpretThermalScriptOutput(scriptLine({ code })),
				(error) => error.code === code,
			)
		})
	}

	it('fails when the script output is not a JSON result', () => {
		assert.throws(() => interpretThermalScriptOutput('Access denied'))
	})
})

describe('createSerialQueue', () => {
	it('runs tasks one at a time in submission order', async () => {
		const serialize = createSerialQueue()
		const events = []
		const task = (name, ms) => () =>
			new Promise((resolve) => {
				events.push(`start ${name}`)
				setTimeout(() => {
					events.push(`end ${name}`)
					resolve(name)
				}, ms)
			})

		const results = await Promise.all([
			serialize(task('a', 20)),
			serialize(task('b', 1)),
		])

		assert.deepEqual(results, ['a', 'b'])
		assert.deepEqual(events, ['start a', 'end a', 'start b', 'end b'])
	})

	it('keeps running later tasks after one fails', async () => {
		const serialize = createSerialQueue()
		const failed = serialize(async () => {
			throw new Error('paper out')
		})
		const next = serialize(async () => 'printed')

		await assert.rejects(failed)
		assert.equal(await next, 'printed')
	})
})
