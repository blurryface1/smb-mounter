import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import Module from 'node:module'

const require = createRequire(import.meta.url)

function loadConfigStore(homePath) {
  const modulePath = require.resolve('../out-test/core/configStore.js')
  const originalLoad = Module._load

  delete require.cache[modulePath]
  Module._load = (request, parent, isMain) => {
    if (request === 'electron') {
      return { app: { getPath: () => homePath } }
    }
    if (request === './crypto') {
      return { encrypt: value => value, decrypt: value => value }
    }
    return originalLoad(request, parent, isMain)
  }

  try {
    return require(modulePath)
  } finally {
    Module._load = originalLoad
  }
}

test('restricts existing config directory and file permissions', () => {
  const homePath = mkdtempSync(join(tmpdir(), 'smb-mounter-config-'))
  const configDir = join(homePath, '.smb-mounter')
  const configFile = join(configDir, 'config.json')

  try {
    mkdirSync(configDir, { mode: 0o777 })
    writeFileSync(configFile, '{"mounts":[],"settings":{}}', { mode: 0o666 })
    const { saveConfig } = loadConfigStore(homePath)

    saveConfig({ mounts: [], settings: {} })

    assert.equal(statSync(configDir).mode & 0o777, 0o700)
    assert.equal(statSync(configFile).mode & 0o777, 0o600)
  } finally {
    rmSync(homePath, { recursive: true, force: true })
  }
})

test('corrects the common /User/Shared mount path typo when loading and saving', () => {
  const homePath = mkdtempSync(join(tmpdir(), 'smb-mounter-config-'))
  const configDir = join(homePath, '.smb-mounter')
  const configFile = join(configDir, 'config.json')
  const storedMount = {
    id: 'mount-1',
    name: '文件',
    server: 'nas.local',
    shareName: '文件',
    username: 'admin',
    mountPath: '/User/Shared/SMB/文件',
    autoMount: false,
    autoRetry: false,
    retryInterval: 30,
    createdAt: 1,
    updatedAt: 1
  }

  try {
    mkdirSync(configDir)
    writeFileSync(configFile, JSON.stringify({
      mounts: [storedMount],
      settings: { defaultMountPath: '/User/Shared/SMB' }
    }))
    const configStore = loadConfigStore(homePath)

    const loaded = configStore.loadConfig()
    const added = configStore.addMount({
      ...storedMount,
      id: undefined,
      createdAt: undefined,
      updatedAt: undefined,
      password: 'secret'
    })

    assert.equal(loaded.mounts[0].mountPath, '/Users/Shared/SMB/文件')
    assert.equal(loaded.settings.defaultMountPath, '/Users/Shared/SMB')
    assert.equal(added.mountPath, '/Users/Shared/SMB/文件')
  } finally {
    rmSync(homePath, { recursive: true, force: true })
  }
})
