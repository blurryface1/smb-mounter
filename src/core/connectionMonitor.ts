// src/core/connectionMonitor.ts
import { getMounts, getSettings } from './configStore'
import { mountManager } from './mountManager'
import { diagnosticLog } from './diagnosticLogger'

class ConnectionMonitor {
  private intervalId: NodeJS.Timeout | null = null
  private checking = false
  private lastRetryAt: Map<string, number> = new Map()

  start(): void {
    if (this.intervalId) return

    const checkInterval = getSettings().checkInterval * 1000

    this.intervalId = setInterval(() => {
      this.checkAllMounts()
    }, checkInterval)

    // Initial check
    this.checkAllMounts()
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  restart(): void {
    this.stop()
    this.start()
  }

  private async checkAllMounts(): Promise<void> {
    if (this.checking) return

    this.checking = true
    const mounts = getMounts()

    try {
      for (const mount of mounts) {
        const status = await mountManager.refreshStatus(mount)

        if (status.status === 'disconnected' && mount.autoRetry && this.canRetry(mount.id, mount.retryInterval)) {
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
          await mountManager.retryMount(mount.id)
        }
      }
    } finally {
      this.checking = false
    }
  }

  async checkAndRemount(): Promise<void> {
    const mounts = getMounts()

    for (const mount of mounts) {
      if (mount.autoMount) {
        const status = await mountManager.refreshStatus(mount)
        if (status.status === 'disconnected') {
          await diagnosticLog('info', 'mount.start', {
            mountId: mount.id,
            mountName: mount.name,
            server: mount.server,
            shareName: mount.shareName,
            username: mount.username,
            mountPath: mount.mountPath,
            reason: 'autoMount'
          })
          await mountManager.mount(mount.id)
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
