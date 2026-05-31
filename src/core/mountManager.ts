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
import { diagnosticLog } from './diagnosticLogger'

function getMountLogMetadata(mount: StoredMountConfig): Record<string, unknown> {
  return {
    mountId: mount.id,
    mountName: mount.name,
    server: mount.server,
    shareName: mount.shareName,
    username: mount.username,
    mountPath: mount.mountPath,
    autoMount: mount.autoMount,
    autoRetry: mount.autoRetry
  }
}

interface MountOperationOptions {
  openSystemAutomountInFinder?: boolean
  source?: 'manual' | 'autoMount' | 'autoRetry'
}

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
    await diagnosticLog('info', 'status.refresh', {
      ...getMountLogMetadata(mount),
      status: status.status,
      retryCount: status.retryCount
    })

    return status
  }

  async refreshAllStatuses(): Promise<void> {
    const mounts = getMounts()
    await Promise.allSettled(mounts.map(m => this.refreshStatus(m)))
  }

  async mount(
    configId: string,
    options: MountOperationOptions = {}
  ): Promise<{ success: boolean; error?: string }> {
    const mount = getMountById(configId)
    if (!mount) {
      return { success: false, error: 'Mount config not found' }
    }

    const existingStatus = this.statuses.get(configId)
    const retryCount = existingStatus?.retryCount ?? 0
    await diagnosticLog('info', 'mount.start', {
      ...getMountLogMetadata(mount),
      retryCount,
      source: options.source ?? 'manual',
      openSystemAutomountInFinder: options.openSystemAutomountInFinder === true
    })

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
      await diagnosticLog('info', 'mount.alreadyActive', {
        ...getMountLogMetadata(mount),
        status: status.status
      })
      return { success: true }
    }

    if (isSystemAutomountPath(mount.mountPath)) {
      await diagnosticLog('info', 'mount.systemAutomount.start', {
        ...getMountLogMetadata(mount),
        source: options.source ?? 'manual',
        openSystemAutomountInFinder: options.openSystemAutomountInFinder === true
      })
      const triggered = await triggerSystemAutomount(mount.mountPath, {
        openInFinder: options.openSystemAutomountInFinder === true
      })
      await diagnosticLog('info', 'mount.systemAutomount.result', {
        ...getMountLogMetadata(mount),
        triggered,
        source: options.source ?? 'manual',
        openSystemAutomountInFinder: options.openSystemAutomountInFinder === true
      })

      if (await isMountActive(mount.mountPath, mount)) {
        const status: MountStatus = {
          configId,
          status: 'mounted',
          lastChecked: Date.now(),
          retryCount: 0
        }
        this.statuses.set(configId, status)
        this.notifyStatusChange(configId, status)
        await diagnosticLog('info', 'mount.success', {
          ...getMountLogMetadata(mount),
          status: status.status
        })
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
      await diagnosticLog('error', 'mount.error', {
        ...getMountLogMetadata(mount),
        error: status.errorMessage
      })
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
        await diagnosticLog('error', 'mount.error', {
          ...getMountLogMetadata(mount),
          error: status.errorMessage
        })
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
      await diagnosticLog('error', 'mount.error', {
        ...getMountLogMetadata(mount),
        error: status.errorMessage
      })
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
    await diagnosticLog(result.success ? 'info' : 'error', result.success ? 'mount.success' : 'mount.error', {
      ...getMountLogMetadata(mount),
      error: result.error,
      status: status.status
    })

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
    await diagnosticLog('info', 'mount.unmount.start', getMountLogMetadata(mount))

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
    await diagnosticLog(result.success ? 'info' : 'error', 'mount.unmount.result', {
      ...getMountLogMetadata(mount),
      success: result.success,
      error: result.error
    })

    return result
  }

  async retryMount(
    configId: string,
    options: MountOperationOptions = {}
  ): Promise<{ success: boolean; error?: string }> {
    const existing = this.statuses.get(configId)

    if (existing) {
      this.statuses.set(configId, {
        ...existing,
        retryCount: existing.retryCount + 1
      })
    }

    const mount = getMountById(configId)
    if (mount) {
      await diagnosticLog('info', 'mount.retry.start', {
        ...getMountLogMetadata(mount),
        retryCount: (existing?.retryCount ?? 0) + 1,
        source: options.source ?? 'manual',
        openSystemAutomountInFinder: options.openSystemAutomountInFinder === true
      })
    }

    await flushDNS()
    return this.mount(configId, options)
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
