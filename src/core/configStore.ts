// src/core/configStore.ts
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { StoredMountConfig, AppConfig, AppSettings, DEFAULT_SETTINGS } from '../types'
import { encrypt, decrypt } from './crypto'

const CONFIG_DIR = join(app.getPath('home'), '.smb-mounter')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

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
    return JSON.parse(data)
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

  const { password, ...mountWithoutPassword } = mount

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
  const { password, ...updatesWithoutPassword } = updates

  const updated: StoredMountConfig = {
    ...existing,
    ...updatesWithoutPassword,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
    encryptedPassword: password
      ? encrypt(password)
      : updates.encryptedPassword ?? existing.encryptedPassword
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
  return loadConfig().settings
}

export function updateSettings(updates: Partial<AppSettings>): AppSettings {
  const config = loadRawConfig()
  config.settings = { ...config.settings, ...updates }
  saveConfig(config)
  return config.settings
}
