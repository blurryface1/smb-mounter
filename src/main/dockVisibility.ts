import type { App } from 'electron'

type ActivationPolicy = Parameters<App['setActivationPolicy']>[0]

export interface DocklessMenuBarApp {
  setActivationPolicy(policy: ActivationPolicy): void
  dock?: {
    hide(): void
  }
}

export function configureDocklessMenuBarMode(
  app: DocklessMenuBarApp,
  platform: NodeJS.Platform = process.platform
): void {
  if (platform !== 'darwin') return

  app.setActivationPolicy('accessory')
  app.dock?.hide()
}
