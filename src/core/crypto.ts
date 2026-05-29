// src/core/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { safeStorage } from 'electron'
import { hostname } from 'os'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 32
const AUTH_TAG_LENGTH = 16
const MIN_BUFFER_LENGTH = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
const SAFE_STORAGE_PREFIX = 'safe-storage:'

/**
 * Legacy fallback warning
 *
 * New credentials use Electron safeStorage, backed by the operating system's
 * credential storage where available. The hostname-derived AES-GCM path remains
 * only so existing configs can still be decrypted and as a last-resort fallback.
 */
function getMasterKey(): Buffer {
  const machineId = hostname()
  return scryptSync(machineId, 'smb-mounter-salt', 32)
}

export function encrypt(plaintext: string): string {
  if (isSafeStorageAvailable()) {
    return SAFE_STORAGE_PREFIX + safeStorage.encryptString(plaintext).toString('base64')
  }

  return encryptLegacy(plaintext)
}

export function decrypt(encryptedData: string): string {
  if (encryptedData.startsWith(SAFE_STORAGE_PREFIX)) {
    if (!isSafeStorageAvailable()) {
      throw new Error('OS credential storage is not available')
    }

    const encrypted = Buffer.from(encryptedData.slice(SAFE_STORAGE_PREFIX.length), 'base64')
    return safeStorage.decryptString(encrypted)
  }

  return decryptLegacy(encryptedData)
}

function isSafeStorageAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

function encryptLegacy(plaintext: string): string {
  const masterKey = getMasterKey()
  const iv = randomBytes(IV_LENGTH)
  const salt = randomBytes(SALT_LENGTH)

  const key = scryptSync(masterKey, salt, 32)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ])

  const authTag = cipher.getAuthTag()

  // Format: salt (32) + iv (16) + authTag (16) + encrypted
  const result = Buffer.concat([salt, iv, authTag, encrypted])
  return result.toString('base64')
}

function decryptLegacy(encryptedData: string): string {
  const masterKey = getMasterKey()
  const buffer = Buffer.from(encryptedData, 'base64')

  // Validate minimum buffer length to prevent out-of-bounds access
  if (buffer.length < MIN_BUFFER_LENGTH) {
    throw new Error(
      `Invalid encrypted data: buffer too short (${buffer.length} bytes, minimum ${MIN_BUFFER_LENGTH} required)`
    )
  }

  const salt = buffer.subarray(0, SALT_LENGTH)
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const authTag = buffer.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  )
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH)

  const key = scryptSync(masterKey, salt, 32)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  try {
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ])
    return decrypted.toString('utf8')
  } catch {
    throw new Error('Decryption failed - data may be corrupted')
  }
}
