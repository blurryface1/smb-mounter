import assert from 'node:assert/strict'
import test from 'node:test'
import { createCipheriv, scryptSync } from 'node:crypto'
import { createRequire } from 'node:module'
import Module from 'node:module'

const require = createRequire(import.meta.url)

function loadCryptoWithSafeStorage(available) {
  const modulePath = require.resolve('../out-test/core/crypto.js')
  const originalLoad = Module._load

  delete require.cache[modulePath]
  Module._load = (request, parent, isMain) => {
    if (request === 'electron') {
      return {
        safeStorage: {
          isEncryptionAvailable: () => available,
          encryptString: value => Buffer.from(`encrypted:${value}`),
          decryptString: value => value.toString().replace(/^encrypted:/, '')
        }
      }
    }
    if (request === 'os') return { hostname: () => 'fixture-host' }
    return originalLoad(request, parent, isMain)
  }

  try {
    return require(modulePath)
  } finally {
    Module._load = originalLoad
  }
}

function encryptLegacyFixture(plaintext) {
  const salt = Buffer.alloc(32, 1)
  const iv = Buffer.alloc(16, 2)
  const masterKey = scryptSync('fixture-host', 'smb-mounter-salt', 32)
  const key = scryptSync(masterKey, salt, 32)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])

  return Buffer.concat([salt, iv, cipher.getAuthTag(), encrypted]).toString('base64')
}

test('refuses to write credentials when OS credential storage is unavailable', () => {
  const { encrypt } = loadCryptoWithSafeStorage(false)

  assert.throws(
    () => encrypt('super-secret'),
    /OS credential storage is not available/
  )
})

test('keeps decrypting legacy hostname-derived credentials', () => {
  const { decrypt } = loadCryptoWithSafeStorage(false)

  assert.equal(decrypt(encryptLegacyFixture('legacy-secret')), 'legacy-secret')
})
