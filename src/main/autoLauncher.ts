// src/main/autoLauncher.ts
import { app } from 'electron'
import { getSettings, updateSettings } from '../core/configStore'

export async function enableLaunchAtLogin(): Promise<boolean> {
  try {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true
    })
    return true
  } catch (err) {
    console.error('Failed to enable launch at login:', err)
    return false
  }
}

export async function disableLaunchAtLogin(): Promise<boolean> {
  try {
    app.setLoginItemSettings({
      openAtLogin: false
    })
    return true
  } catch (err) {
    console.error('Failed to disable launch at login:', err)
    return false
  }
}

export async function isLaunchAtLoginEnabled(): Promise<boolean> {
  try {
    return app.getLoginItemSettings().openAtLogin
  } catch {
    return false
  }
}

export function setupAutoLauncher(): void {
  const settings = getSettings()
  if (settings.launchAtLogin) {
    enableLaunchAtLogin()
  }
}

export async function setLaunchAtLogin(enabled: boolean): Promise<void> {
  if (enabled) {
    await enableLaunchAtLogin()
  } else {
    await disableLaunchAtLogin()
  }
  updateSettings({ launchAtLogin: enabled })
}
