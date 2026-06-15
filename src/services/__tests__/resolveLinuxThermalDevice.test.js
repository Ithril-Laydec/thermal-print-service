/**
 * Tests unitarios para la resolución segura del device de la impresora térmica.
 *
 * INVARIANTE: resolveLinuxThermalDevice() NUNCA debe devolver un /dev/usb/lp*
 * arbitrario. Si el symlink udev no existe, lanza Error en lugar de adivinar,
 * evitando así escribir ESC/POS a la HP LaserJet 1320 (/dev/usb/lp2).
 *
 * Runner: node:test (builtin, sin dependencias extra)
 * Ejecutar: node --test src/services/__tests__/resolveLinuxThermalDevice.test.js
 */

'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { resolveLinuxThermalDevice } = require('../RawEscposService')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * existsFn factory: devuelve true solo para los paths incluidos en el set.
 */
function existsOnly(...paths) {
  const set = new Set(paths)
  return (p) => set.has(p)
}

// ---------------------------------------------------------------------------
// Caso nominal
// ---------------------------------------------------------------------------

describe('resolveLinuxThermalDevice — symlink presente', () => {
  it('devuelve /dev/printer/thermal cuando el symlink existe', () => {
    const existsFn = existsOnly('/dev/printer/thermal')
    const device = resolveLinuxThermalDevice({ existsFn })
    assert.equal(device, '/dev/printer/thermal')
  })

  it('devuelve el symlink incluso si también existen /dev/usb/lp0 y lp1', () => {
    const existsFn = existsOnly('/dev/printer/thermal', '/dev/usb/lp0', '/dev/usb/lp1')
    const device = resolveLinuxThermalDevice({ existsFn })
    assert.equal(device, '/dev/printer/thermal')
  })

  it('devuelve el symlink incluso si también existe lp2 (HP)', () => {
    const existsFn = existsOnly('/dev/printer/thermal', '/dev/usb/lp2')
    const device = resolveLinuxThermalDevice({ existsFn })
    assert.equal(device, '/dev/printer/thermal')
  })
})

// ---------------------------------------------------------------------------
// INVARIANTE DE SEGURIDAD — symlink ausente
// ---------------------------------------------------------------------------

describe('resolveLinuxThermalDevice — symlink ausente: NUNCA elige un lp* arbitrario', () => {
  it('lanza Error cuando el symlink no existe y no hay ningún lp*', () => {
    const existsFn = existsOnly()  // nada existe
    assert.throws(
      () => resolveLinuxThermalDevice({ existsFn }),
      (err) => {
        assert.ok(
          /térmica no encontrada|falta \/dev\/printer\/thermal/i.test(err.message),
          `Mensaje inesperado: "${err.message}"`
        )
        return true
      }
    )
  })

  it('lanza Error cuando solo existe lp0 (podría ser la matricial en otro setup)', () => {
    const existsFn = existsOnly('/dev/usb/lp0')
    assert.throws(
      () => resolveLinuxThermalDevice({ existsFn }),
      /térmica no encontrada|falta \/dev\/printer\/thermal/i
    )
  })

  it('lanza Error cuando solo existe lp1 (podría ser térmica en otro lp*)', () => {
    const existsFn = existsOnly('/dev/usb/lp1')
    assert.throws(
      () => resolveLinuxThermalDevice({ existsFn }),
      /térmica no encontrada|falta \/dev\/printer\/thermal/i
    )
  })

  it('NUNCA devuelve /dev/usb/lp2 (HP LaserJet 1320, VID:PID 03f0:1d17)', () => {
    // Escenario crítico: symlink térmico desapareció, pero la HP está en lp2
    const existsFn = existsOnly('/dev/usb/lp2')
    assert.throws(
      () => resolveLinuxThermalDevice({ existsFn }),
      (err) => {
        // Verificar que la excepción NO menciona lp2 como device elegido
        assert.ok(!err.message.includes('lp2') || /térmica no encontrada/i.test(err.message),
          `La función eligió la HP: "${err.message}"`)
        return true
      }
    )
  })

  it('NUNCA devuelve lp2 cuando lp0, lp1 y lp2 existen pero falta el symlink', () => {
    // Escenario más realista: todos los lp* existen (térmica en lp1, HP en lp2)
    // pero el symlink udev no está → debe fallar, no adivinar
    const existsFn = existsOnly('/dev/usb/lp0', '/dev/usb/lp1', '/dev/usb/lp2')
    assert.throws(
      () => resolveLinuxThermalDevice({ existsFn }),
      /térmica no encontrada|falta \/dev\/printer\/thermal/i
    )
  })

  it('el mensaje de error es accionable (menciona cómo recuperar)', () => {
    const existsFn = existsOnly()
    let err
    assert.throws(
      () => resolveLinuxThermalDevice({ existsFn }),
      (e) => { err = e; return true }
    )
    // Debe orientar al operador: qué hacer para reparar el symlink
    assert.ok(
      /udevadm|udev|USB|symlink/i.test(err.message),
      `El mensaje no orienta al operador: "${err.message}"`
    )
  })
})

// ---------------------------------------------------------------------------
// Verificación de que printLinux también es seguro (integración superficial)
// ---------------------------------------------------------------------------

describe('RawEscposService — exports disponibles para integración', () => {
  it('exporta printWithRawBuffer y printToDiplodocus', () => {
    const svc = require('../RawEscposService')
    assert.equal(typeof svc.printWithRawBuffer, 'function')
    assert.equal(typeof svc.printToDiplodocus, 'function')
    assert.equal(typeof svc.printToSato, 'function')
  })

  it('exporta resolveLinuxThermalDevice para tests externos', () => {
    const svc = require('../RawEscposService')
    assert.equal(typeof svc.resolveLinuxThermalDevice, 'function')
  })
})
