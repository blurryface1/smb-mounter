// src/core/mountManager.ts
import { BrowserWindow, Notification } from 'electron'
import { StoredMountConfig, MountStatus } from '../types'
import { getMountById, getMounts, getDecryptedPassword, getSettings } from './configStore'
import {
  mountSMB,
  unmountSMB,
  isMountActive,
  checkServerReachable,
  flushDNS,
  isSystemAutomountPath,
  triggerSystemAutomount
} from './smb'

class MountManager {
  private statuses: Map<string, MountStatus> = new Map()
  private mainWindow: BrowserWindow | null = null

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  clearMainWindow(): void {
    this.mainWindow = null
  }

  getStatus(configId: string): MountStatus | undefined {
    return this.statuses.get(configId)
  }

  getAllStatuses(): MountStatus[] {
    return Array.from(this.statuses.values())
  }

  async refreshStatus(mount: StoredMountConfig): Promise<MountStatus> {
    const active = await isMountActive(mount.mountPath, mount)
    const existing = this.statuses.get(mount.id)

    const status: MountStatus = {
      configId: mount.id,
      status: active ? 'mounted' : 'disconnected',
      lastChecked: Date.now(),
      retryCount: existing?.retryCount ?? 0
    }

    this.statuses.set(mount.id, status)
    this.notifyStatusChange(mount.id, status)

    return status
  }

  async refreshAllStatuses(): Promise<void> {
    const mounts = getMounts()
    await Promise.allSettled(mounts.map(m => this.refreshStatus(m)))
  }

  async mount(configId: string): Promise<{ success: boolean; error?: string }> {
    const mount = getMountById(configId)
    if (!mount) {
      return { success: false, error: 'Mount config not found' }
    }

    const existingStatus = this.statuses.get(configId)
    const retryCount = existingStatus?.retryCount ?? 0

    // Update status to pending
    this.statuses.set(configId, {
      configId,
      status: 'pending',
      lastChecked: Date.now(),
      retryCount
    })
    this.notifyStatusChange(configId, this.statuses.get(configId)!)

    // Check if already mounted
    if (await isMountActive(mount.mountPath, mount)) {
      const status: MountStatus = {
        configId,
        status: 'mounted',
        lastChecked: Date.now(),
        retryCount: 0
      }
      this.statuses.set(configId, status)
      this.notifyStatusChange(configId, status)
      return { success: true }
    }

    if (isSystemAutomountPath(mount.mountPath)) {
      await triggerSystemAutomount(mount.mountPath)

      if (await isMountActive(mount.mountPath, mount)) {
        const status: MountStatus = {
          configId,
          status: 'mounted',
          lastChecked: Date.now(),
          retryCount: 0
        }
        this.statuses.set(configId, status)
        this.notifyStatusChange(configId, status)
        return { success: true }
      }

      const status: MountStatus = {
        configId,
        status: 'error',
        lastChecked: Date.now(),
        retryCount,
        errorMessage: 'System-managed SMB automount path is not active. Open it in Finder or choose an app-managed mount path outside /System/Volumes/Data/mnt/SMB.'
      }
      this.statuses.set(configId, status)
      this.notifyStatusChange(configId, status)
      return { success: false, error: status.errorMessage }
    }

    // Check server reachable
    const reachable = await checkServerReachable(mount.server)
    if (!reachable) {
      await flushDNS()
      const retryReachable = await checkServerReachable(mount.server)
      if (!retryReachable) {
        const status: MountStatus = {
          configId,
          status: 'error',
          lastChecked: Date.now(),
          retryCount,
          errorMessage: `Cannot reach server ${mount.server}`
        }
        this.statuses.set(configId, status)
        this.notifyStatusChange(configId, status)
        return { success: false, error: status.errorMessage }
      }
    }

    // Get password
    const password = getDecryptedPassword(mount)
    if (!password) {
      const status: MountStatus = {
        configId,
        status: 'error',
        lastChecked: Date.now(),
        retryCount,
        errorMessage: 'Password not available'
      }
      this.statuses.set(configId, status)
      this.notifyStatusChange(configId, status)
      return { success: false, error: status.errorMessage }
    }

    // Mount
    const result = await mountSMB(
      mount.server,
      mount.shareName,
      mount.username,
      password,
      mount.mountPath
    )

    const status: MountStatus = {
      configId,
      status: result.success ? 'mounted' : 'error',
      lastChecked: Date.now(),
      retryCount: result.success ? 0 : retryCount,
      errorMessage: result.error
    }
    this.statuses.set(configId, status)
    this.notifyStatusChange(configId, status)

    if (result.success) {
      this.showNotification(`${mount.name} mounted successfully`)
    }

    return result
  }

  async unmount(configId: string): Promise<{ success: boolean; error?: string }> {
    const mount = getMountById(configId)
    if (!mount) {
      return { success: false, error: 'Mount config not found' }
    }

    const result = await unmountSMB(mount.mountPath)

    const status: MountStatus = {
      configId,
      status: result.success ? 'disconnected' : 'error',
      lastChecked: Date.now(),
      retryCount: 0,
      errorMessage: result.error
    }
    this.statuses.set(configId, status)
    this.notifyStatusChange(configId, status)

    return result
  }

  async retryMount(configId: string): Promise<{ success: boolean; error?: string }> {
    const existing = this.statuses.get(configId)

    if (existing) {
      this.statuses.set(configId, {
        ...existing,
        retryCount: existing.retryCount + 1
      })
    }

    await flushDNS()
    return this.mount(configId)
  }

  private notifyStatusChange(configId: string, status: MountStatus): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('mount-status-changed', { configId, status })
    }
  }

  private showNotification(message: string): void {
    const settings = getSettings()
    if (settings.showNotifications) {
      new Notification({
        title: 'SMB Mounter',
        body: message
      }).show()
    }
  }
}

export const mountManager = new MountManager()
