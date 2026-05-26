// src/main/autoLauncher.ts
import { app } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import { getSettings, updateSettings } from '../core/configStore'

const execAsync = promisify(exec)

const APP_NAME = 'SMB Mounter'

function getAppBundlePath(): string {
  if (!app.isPackaged) return ''
  return app.getPath('exe')
}

export async function enableLaunchAtLogin(): Promise<boolean> {
  try {
    const appPath = getAppBundlePath()
    if (!appPath) return false

    await execAsync(`osascript -e 'tell application "System Events" to make login item at end with properties {path:"${appPath}", hidden:true}'`)
    return true
  } catch (err) {
    console.error('Failed to enable launch at login:', err)
    return false
  }
}

export async function disableLaunchAtLogin(): Promise<boolean> {
  try {
    await execAsync(`osascript -e 'tell application "System Events" to delete login item "${APP_NAME}"'`)
    return true
  } catch (err) {
    console.error('Failed to disable launch at login:', err)
    return false
  }
}

export async function isLaunchAtLoginEnabled(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('osascript -e "tell application \\"System Events\\" to get the name of every login item"')
    return stdout.includes(APP_NAME)
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