// src/main/tray.ts
import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron'
import type { NativeImage } from 'electron'
import { join } from 'path'

let tray: Tray | null = null
const TRAY_ICON_SIZE = 18

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

export function setupTray(mainWindow: BrowserWindow): void {
  tray = new Tray(createTrayImage('trayConnected.png'))

  updateTrayMenu(mainWindow)

  tray.on('click', () => {
    mainWindow.show()
    mainWindow.focus()
  })
}

export function updateTrayMenu(mainWindow: BrowserWindow): void {
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
      click: () => {
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

  const iconMap = {
    connected: 'trayConnected.png',
    disconnected: 'trayDisconnected.png',
    error: 'trayError.png'
  }

  tray.setImage(createTrayImage(iconMap[status]))
}
