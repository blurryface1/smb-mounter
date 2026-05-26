// src/core/connectionMonitor.ts
import { getMounts, getSettings } from './configStore'
import { mountManager } from './mountManager'

class ConnectionMonitor {
  private intervalId: NodeJS.Timeout | null = null

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

  private async checkAllMounts(): Promise<void> {
    const mounts = getMounts()

    for (const mount of mounts) {
      const status = await mountManager.refreshStatus(mount)

      // Auto-retry disconnected mounts that have autoRetry enabled
      if (status.status === 'disconnected' && mount.autoRetry) {
        console.log(`Auto-retrying mount: ${mount.name}`)
        await mountManager.retryMount(mount.id)
      }
    }
  }

  async checkAndRemount(): Promise<void> {
    const mounts = getMounts()

    for (const mount of mounts) {
      if (mount.autoMount) {
        const status = await mountManager.refreshStatus(mount)
        if (status.status === 'disconnected') {
          await mountManager.mount(mount.id)
        }
      }
    }
  }
}

export const connectionMonitor = new ConnectionMonitor()
