// src/core/crypto.ts
import { createDecipheriv, scryptSync } from 'crypto'
import { safeStorage } from 'electron'
import { hostname } from 'os'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 32
const AUTH_TAG_LENGTH = 16
const MIN_BUFFER_LENGTH = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
const SAFE_STORAGE_PREFIX = 'safe-storage:'

function getMasterKey(): Buffer {
  const machineId = hostname()
  return scryptSync(machineId, 'smb-mounter-salt', 32)
}

export function encrypt(plaintext: string): string {
  if (!isSafeStorageAvailable()) {
    throw new Error('OS credential storage is not available')
  }

  return SAFE_STORAGE_PREFIX + safeStorage.encryptString(plaintext).toString('base64')
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
