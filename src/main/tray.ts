// src/main/tray.ts
import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron'
import { join } from 'path'

let tray: Tray | null = null
const TRAY_ICON_SIZE = 18

function getAssetPath(filename: string): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'assets', filename)
  }
  return join(__dirname, '../../assets', filename)
}

export function setupTray(mainWindow: BrowserWindow): void {
  const iconPath = getAssetPath('trayConnected.png')
  const icon = nativeImage.createFromPath(iconPath)

  // Fallback to empty icon if file not found
  if (icon.isEmpty()) {
    tray = new Tray(nativeImage.createEmpty())
  } else {
    tray = new Tray(icon.resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE }))
  }

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

  const iconPath = getAssetPath(iconMap[status])
  const icon = nativeImage.createFromPath(iconPath)

  if (!icon.isEmpty()) {
    tray.setImage(icon.resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE }))
  }
}
