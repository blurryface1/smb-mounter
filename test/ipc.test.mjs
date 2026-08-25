import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import Module from 'node:module'

const require = createRequire(import.meta.url)

function loadIPC(handlers, showOpenDialog, defaultMountPath = '/Users/Shared/SMB') {
  const modulePath = require.resolve('../out-test/main/ipc.js')
  const originalLoad = Module._load
  const dependencies = {
    '../core/mountManager': { mountManager: {} },
    '../core/connectionMonitor': { connectionMonitor: {} },
    '../core/shareDiscovery': {},
    '../core/configStore': {
      getSettings: () => ({ defaultMountPath })
    },
    '../core/detectMounts': {},
    '../core/systemMountMatcher': {},
    './autoLauncher': {},
    '../core/diagnosticLogger': {}
  }

  delete require.cache[modulePath]
  Module._load = (request, parent, isMain) => {
    if (request === 'electron') {
      return {
        BrowserWindow: class {},
        dialog: { showOpenDialog },
        ipcMain: {
          handle(channel, handler) {
            handlers.set(channel, handler)
          }
        },
        shell: {}
      }
    }
    if (parent?.filename === modulePath && request in dependencies) {
      return dependencies[request]
    }
    return originalLoad(request, parent, isMain)
  }

  try {
    return require(modulePath)
  } finally {
    Module._load = originalLoad
  }
}

test('creates and opens the requested starting directory in the Finder picker', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'smb-mounter-picker-'))
  const initialPath = join(temporaryRoot, 'SMB', '文件')
  const handlers = new Map()
  let dialogOptions

  try {
    const { setupIPC } = loadIPC(handlers, async (_window, options) => {
      dialogOptions = options
      return { canceled: true, filePaths: [] }
    })
    setupIPC({})

    const result = await handlers.get('select-directory')({}, initialPath)

    assert.equal(result, null)
    assert.equal(existsSync(initialPath), true)
    assert.equal(dialogOptions.defaultPath, initialPath)
    assert.deepEqual(dialogOptions.properties, ['openDirectory', 'createDirectory'])
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
})

test('falls back to the configured mount root when the requested directory is unusable', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'smb-mounter-picker-'))
  const blockingFile = join(temporaryRoot, 'blocking-file')
  const fallbackPath = join(temporaryRoot, 'fallback', 'SMB')
  const handlers = new Map()
  let dialogOptions
  writeFileSync(blockingFile, '')

  try {
    const { setupIPC } = loadIPC(handlers, async (_window, options) => {
      dialogOptions = options
      return { canceled: true, filePaths: [] }
    }, fallbackPath)
    setupIPC({})

    await handlers.get('select-directory')({}, join(blockingFile, '文件'))

    assert.equal(existsSync(fallbackPath), true)
    assert.equal(dialogOptions.defaultPath, fallbackPath)
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
})
