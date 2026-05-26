// src/main/tray.ts
import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron'
import { join } from 'path'

let tray: Tray | null = null

export function setupTray(mainWindow: BrowserWindow): void {
  const iconPath = join(__dirname, '../../assets/trayConnected.png')
  const icon = nativeImage.createFromPath(iconPath)

  tray = new Tray(icon.resize({ width: 16, height: 16 }))

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

  const iconPath = join(__dirname, '../../assets', iconMap[status])
  const icon = nativeImage.createFromPath(iconPath)
  tray.setImage(icon.resize({ width: 16, height: 16 }))
}
