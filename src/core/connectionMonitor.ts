// src/core/connectionMonitor.ts
import { getMounts, getSettings } from './configStore'
import { mountManager } from './mountManager'
import { diagnosticLog } from './diagnosticLogger'

class ConnectionMonitor {
  private intervalId: NodeJS.Timeout | null = null
  private checking = false
  private lastRetryAt: Map<string, number> = new Map()

  async start(): Promise<void> {
    if (this.intervalId) return

    const checkInterval = getSettings().checkInterval * 1000

    this.intervalId = setInterval(() => {
      void this.checkAllMounts()
    }, checkInterval)

    await this.checkAndRemount()
    await this.checkAllMounts()
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  async restart(): Promise<void> {
    this.stop()
    await this.start()
  }

  private async checkAllMounts(): Promise<void> {
    if (this.checking) return

    this.checking = true
    const mounts = getMounts()

    try {
      const statuses = new Map(
        (await mountManager.refreshAllStatuses()).map(status => [status.configId, status])
      )

      for (const mount of mounts) {
        const status = statuses.get(mount.id)

        if (status?.status === 'disconnected' && mount.autoRetry && this.canRetry(mount.id, mount.retryInterval)) {
          console.log(`Auto-retrying mount: ${mount.name}`)
          await diagnosticLog('info', 'mount.retry.start', {
            mountId: mount.id,
            mountName: mount.name,
            server: mount.server,
            shareName: mount.shareName,
            username: mount.username,
            mountPath: mount.mountPath,
            reason: 'autoRetry'
          })
          this.lastRetryAt.set(mount.id, Date.now())
          await mountManager.retryMount(mount.id, {
            source: 'autoRetry',
            openSystemAutomountInFinder: false
          })
        }
      }
    } finally {
      this.checking = false
    }
  }

  async checkAndRemount(): Promise<void> {
    const mounts = getMounts()
    const statuses = new Map(
      (await mountManager.refreshAllStatuses()).map(status => [status.configId, status])
    )

    for (const mount of mounts) {
      if (mount.autoMount) {
        const status = statuses.get(mount.id)
        if (status?.status === 'disconnected') {
          await diagnosticLog('info', 'mount.start', {
            mountId: mount.id,
            mountName: mount.name,
            server: mount.server,
            shareName: mount.shareName,
            username: mount.username,
            mountPath: mount.mountPath,
            reason: 'autoMount'
          })
          await mountManager.mount(mount.id, {
            source: 'autoMount',
            openSystemAutomountInFinder: false
          })
        }
      }
    }
  }

  private canRetry(configId: string, retryInterval: number): boolean {
    const intervalMs = Math.max(retryInterval, 5) * 1000
    const lastRetry = this.lastRetryAt.get(configId) ?? 0
    return Date.now() - lastRetry >= intervalMs
  }
}

export const connectionMonitor = new ConnectionMonitor()
