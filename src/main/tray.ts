// src/main/tray.ts
import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron'
import type { NativeImage } from 'electron'
import { join } from 'path'
import type { MountStatus } from '../types'

let tray: Tray | null = null
const TRAY_ICON_SIZE = 18

interface TrayStatusSource {
  getAllStatuses: () => MountStatus[]
  refreshAllStatuses: () => Promise<MountStatus[]>
  onStatusesChanged: (listener: (statuses: MountStatus[]) => void) => () => void
}

function getAssetPath(filename: string): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'assets', filename)
  }
  return join(__dirname, '../../assets', filename)
}

function createTrayImage(filename: string): NativeImage {
  const icon = nativeImage.createFromPath(getAssetPath(filename))

  if (icon.isEmpty()) {
    return nativeImage.createEmpty()
  }

  const resizedIcon = icon.resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE })
  resizedIcon.setTemplateImage(true)
  return resizedIcon
}

function getTrayStatus(statuses: MountStatus[]): 'connected' | 'disconnected' | 'error' {
  if (statuses.some(status => status.status === 'error')) return 'error'
  if (statuses.length > 0 && statuses.every(status => status.status === 'mounted')) return 'connected'
  return 'disconnected'
}

function getTrayIconFilename(status: 'connected' | 'disconnected' | 'error'): string {
  return {
    connected: 'trayConnected.png',
    disconnected: 'trayDisconnected.png',
    error: 'trayError.png'
  }[status]
}

export function setupTray(mainWindow: BrowserWindow, statusSource: TrayStatusSource): void {
  const initialStatus = getTrayStatus(statusSource.getAllStatuses())
  tray = new Tray(createTrayImage(getTrayIconFilename(initialStatus)))
  statusSource.onStatusesChanged(statuses => updateTrayIcon(getTrayStatus(statuses)))

  updateTrayMenu(mainWindow, statusSource)

  tray.on('click', () => {
    mainWindow.show()
    mainWindow.focus()
  })
}

export function updateTrayMenu(mainWindow: BrowserWindow, statusSource: TrayStatusSource): void {
  if (!tray) return

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Settings',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    {
      label: 'Refresh All Mounts',
      click: async () => {
        await statusSource.refreshAllStatuses()
        mainWindow.webContents.send('refresh-all-mounts')
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setToolTip('SMB Mounter')
  tray.setContextMenu(contextMenu)
}

export function updateTrayIcon(status: 'connected' | 'disconnected' | 'error'): void {
  if (!tray) return
  tray.setImage(createTrayImage(getTrayIconFilename(status)))
}
