// src/core/configStore.ts
import { app } from 'electron'
import { isAbsolute, normalize } from 'path'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { StoredMountConfig, AppConfig, AppSettings, DEFAULT_SETTINGS } from '../types'
import { encrypt, decrypt } from './crypto'

const CONFIG_DIR = join(app.getPath('home'), '.smb-mounter')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')
const MIN_RETRY_INTERVAL = 5
const MAX_RETRY_INTERVAL = 300

type MountWriteInput = Partial<StoredMountConfig> & { password?: string }

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`)
  }

  return value.trim()
}

function requireServer(value: unknown): string {
  const server = requireNonEmptyString(value, 'Server')
  if (server.includes('/') || server.includes('\\')) {
    throw new Error('Server must be a hostname or IP address')
  }

  return server
}

function requireShareName(value: unknown): string {
  const shareName = requireNonEmptyString(value, 'Share name')
  if (shareName.includes('/') || shareName.includes('\\')) {
    throw new Error('Share name must not contain path separators')
  }

  return shareName
}

function requireMountPath(value: unknown): string {
  const mountPath = normalize(requireNonEmptyString(value, 'Mount path'))
  if (!isAbsolute(mountPath) || mountPath === '/') {
    throw new Error('Mount path must be an absolute path below a mount directory')
  }

  return mountPath
}

function optionalNonEmptyString(value: unknown, fieldName: string): string | undefined {
  if (typeof value === 'undefined') return undefined
  return requireNonEmptyString(value, fieldName)
}

function optionalServer(value: unknown): string | undefined {
  if (typeof value === 'undefined') return undefined
  return requireServer(value)
}

function optionalShareName(value: unknown): string | undefined {
  if (typeof value === 'undefined') return undefined
  return requireShareName(value)
}

function optionalMountPath(value: unknown): string | undefined {
  if (typeof value === 'undefined') return undefined
  return requireMountPath(value)
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeRetryInterval(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(Math.max(Math.round(value), MIN_RETRY_INTERVAL), MAX_RETRY_INTERVAL)
}

function normalizeMountForAdd(mount: MountWriteInput): Omit<StoredMountConfig, 'id' | 'createdAt' | 'updatedAt'> & { password?: string } {
  return {
    name: requireNonEmptyString(mount.name, 'Mount name'),
    server: requireServer(mount.server),
    shareName: requireShareName(mount.shareName),
    username: requireNonEmptyString(mount.username, 'Username'),
    mountPath: requireMountPath(mount.mountPath),
    autoMount: normalizeBoolean(mount.autoMount, false),
    autoRetry: normalizeBoolean(mount.autoRetry, false),
    retryInterval: normalizeRetryInterval(mount.retryInterval, 30),
    password: typeof mount.password === 'string' ? mount.password : undefined
  }
}

function normalizeMountUpdates(updates: MountWriteInput, existing: StoredMountConfig): Partial<StoredMountConfig> & { password?: string } {
  return {
    name: optionalNonEmptyString(updates.name, 'Mount name') ?? existing.name,
    server: optionalServer(updates.server) ?? existing.server,
    shareName: optionalShareName(updates.shareName) ?? existing.shareName,
    username: optionalNonEmptyString(updates.username, 'Username') ?? existing.username,
    mountPath: optionalMountPath(updates.mountPath) ?? existing.mountPath,
    autoMount: normalizeBoolean(updates.autoMount, existing.autoMount),
    autoRetry: normalizeBoolean(updates.autoRetry, existing.autoRetry),
    retryInterval: normalizeRetryInterval(updates.retryInterval, existing.retryInterval),
    password: typeof updates.password === 'string' ? updates.password : undefined
  }
}

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

function loadRawConfig(): AppConfig {
  ensureConfigDir()

  if (!existsSync(CONFIG_FILE)) {
    return { mounts: [], settings: DEFAULT_SETTINGS }
  }

  try {
    const data = readFileSync(CONFIG_FILE, 'utf-8')
    const parsed = JSON.parse(data) as Partial<AppConfig>

    return {
      mounts: Array.isArray(parsed.mounts) ? parsed.mounts : [],
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings ?? {})
      }
    }
  } catch {
    return { mounts: [], settings: DEFAULT_SETTINGS }
  }
}

export function loadConfig(): AppConfig {
  return loadRawConfig()
}

export function saveConfig(config: AppConfig): void {
  ensureConfigDir()
  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
  } catch (error) {
    console.error('Failed to save config:', error)
    throw new Error('Failed to save configuration file')
  }
}

export function getMounts(): StoredMountConfig[] {
  return loadConfig().mounts
}

export function getMountById(id: string): StoredMountConfig | undefined {
  return getMounts().find(m => m.id === id)
}

export function addMount(mount: Omit<StoredMountConfig, 'id' | 'createdAt' | 'updatedAt'> & { password?: string }): StoredMountConfig {
  const config = loadRawConfig()

  const { password, ...mountWithoutPassword } = normalizeMountForAdd(mount)

  const now = Date.now()
  const newMount: StoredMountConfig = {
    ...mountWithoutPassword,
    id: `mount-${now}-${Math.random().toString(36).substring(2, 11)}`,
    createdAt: now,
    updatedAt: now,
    encryptedPassword: password ? encrypt(password) : undefined
  }

  config.mounts.push(newMount)
  saveConfig(config)

  return newMount
}

export function updateMount(id: string, updates: Partial<StoredMountConfig> & { password?: string }): StoredMountConfig | null {
  const config = loadRawConfig()
  const index = config.mounts.findIndex(m => m.id === id)

  if (index === -1) return null

  const existing = config.mounts[index]
  const { password, ...updatesWithoutPassword } = normalizeMountUpdates(updates, existing)

  const updated: StoredMountConfig = {
    ...existing,
    ...updatesWithoutPassword,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
    encryptedPassword: password
      ? encrypt(password)
      : existing.encryptedPassword
  }

  config.mounts[index] = updated
  saveConfig(config)

  return updated
}

export function deleteMount(id: string): boolean {
  const config = loadRawConfig()
  const index = config.mounts.findIndex(m => m.id === id)

  if (index === -1) return false

  config.mounts.splice(index, 1)
  saveConfig(config)
  return true
}

export function getDecryptedPassword(mount: StoredMountConfig): string | null {
  if (!mount.encryptedPassword) return null

  try {
    return decrypt(mount.encryptedPassword)
  } catch {
    return null
  }
}

export function getSettings(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...loadConfig().settings
  }
}

export function updateSettings(updates: Partial<AppSettings>): AppSettings {
  const config = loadRawConfig()
  config.settings = { ...DEFAULT_SETTINGS, ...config.settings, ...updates }
  saveConfig(config)
  return config.settings
}
