// src/core/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { hostname } from 'os'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 32
const AUTH_TAG_LENGTH = 16
const MIN_BUFFER_LENGTH = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH

/**
 * SECURITY WARNING: Master Key Derivation
 *
 * The current implementation derives the master key from the machine's hostname.
 * This approach has significant security limitations:
 *
 * 1. Hostnames are often predictable and may be exposed in network logs or DNS records
 * 2. An attacker with access to the machine can easily obtain the hostname
 * 3. This provides NO protection against attackers who gain read access to the system
 *
 * RECOMMENDATION FOR PRODUCTION USE:
 * - Store the master key in macOS Keychain using Keychain Access API
 * - Use a hardware security module (HSM) for enterprise deployments
 * - Consider using a properly seeded cryptographic random key stored securely
 * - Rotate keys periodically and implement key rotation mechanisms
 *
 * This implementation is suitable only for obfuscation purposes, NOT for
 * protecting sensitive data. Do NOT use this for passwords, API keys,
 * or any data that requires genuine cryptographic protection.
 */
function getMasterKey(): Buffer {
  // WARNING: hostname-based key derivation is NOT secure for production
  // See the security warning above for proper key management
  const machineId = hostname()
  return scryptSync(machineId, 'smb-mounter-salt', 32)
}

export function encrypt(plaintext: string): string {
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

export function decrypt(encryptedData: string): string {
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
