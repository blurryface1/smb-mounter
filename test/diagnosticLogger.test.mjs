import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  createDiagnosticLogger
} = require('../out-test/core/diagnosticLogger.js')

function createTempBaseDir() {
  return mkdtempSync(join(tmpdir(), 'smb-mounter-log-test-'))
}

function cleanup(path) {
  rmSync(path, { recursive: true, force: true })
}

function readLog(baseDir) {
  return readFileSync(join(baseDir, 'logs', 'app.log'), 'utf-8').trim()
}

test('does not write when diagnostic mode is disabled', async () => {
  const baseDir = createTempBaseDir()
  try {
    const logger = createDiagnosticLogger({ diagnosticMode: false, baseDir })
    await logger.log('info', 'mount.start', { mountId: 'm1' })

    assert.equal(existsSync(join(baseDir, 'logs', 'app.log')), false)
  } finally {
    cleanup(baseDir)
  }
})

test('writes json lines when diagnostic mode is enabled', async () => {
  const baseDir = createTempBaseDir()
  try {
    const logger = createDiagnosticLogger({ diagnosticMode: true, baseDir })
    await logger.log('info', 'mount.start', { mountId: 'm1', server: 'nas.local' })

    const parsed = JSON.parse(readLog(baseDir))
    assert.equal(parsed.level, 'info')
    assert.equal(parsed.event, 'mount.start')
    assert.equal(parsed.mountId, 'm1')
    assert.equal(parsed.server, 'nas.local')
    assert.match(parsed.ts, /^\d{4}-\d{2}-\d{2}T/)
  } finally {
    cleanup(baseDir)
  }
})

test('redacts sensitive fields', async () => {
  const baseDir = createTempBaseDir()
  try {
    const logger = createDiagnosticLogger({ diagnosticMode: true, baseDir })
    await logger.log('info', 'mount.start', {
      password: 'secret',
      encryptedPassword: 'cipher',
      smbUrl: '//user:secret@nas.local/share',
      mountPath: '/Volumes/share'
    })

    const parsed = JSON.parse(readLog(baseDir))
    assert.equal(parsed.password, undefined)
    assert.equal(parsed.encryptedPassword, undefined)
    assert.equal(parsed.smbUrl, '[redacted]')
    assert.equal(parsed.mountPath, '/Volumes/share')
  } finally {
    cleanup(baseDir)
  }
})

test('rotates app log at the configured size and keeps one old file', async () => {
  const baseDir = createTempBaseDir()
  try {
    const logDir = join(baseDir, 'logs')
    const logger = createDiagnosticLogger({ diagnosticMode: true, baseDir, maxBytes: 20 })
    logger.ensureLogFile()
    writeFileSync(join(logDir, 'app.log'), 'x'.repeat(21))

    await logger.log('info', 'mount.start', { mountId: 'm1' })

    assert.equal(readFileSync(join(logDir, 'app.log.1'), 'utf-8'), 'x'.repeat(21))
    const parsed = JSON.parse(readLog(baseDir))
    assert.equal(parsed.event, 'mount.start')
  } finally {
    cleanup(baseDir)
  }
})
