// src/types/index.ts

export interface MountConfig {
  id: string
  name: string
  server: string
  shareName: string
  username: string
  mountPath: string
  autoMount: boolean
  autoRetry: boolean
  retryInterval: number
  createdAt: number
  updatedAt: number
}

export interface StoredMountConfig extends MountConfig {
  encryptedPassword?: string
}

export interface MountStatus {
  configId: string
  status: 'mounted' | 'disconnected' | 'error' | 'pending'
  lastChecked: number
  retryCount: number
  errorMessage?: string
}

export interface AppConfig {
  mounts: StoredMountConfig[]
  settings: AppSettings
}

export interface AppSettings {
  launchAtLogin: boolean
  showNotifications: boolean
  defaultMountPath: string
  checkInterval: number
  diagnosticMode: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  launchAtLogin: false,
  showNotifications: true,
  defaultMountPath: '/Users/Shared/SMB',
  checkInterval: 30,
  diagnosticMode: false
}
