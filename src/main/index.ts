// src/main/index.ts
import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { setupTray } from './tray'
import { setupIPC } from './ipc'
import { setupAutoLauncher } from './autoLauncher'
import { mountManager } from '../core/mountManager'
import { connectionMonitor } from '../core/connectionMonitor'

let mainWindow: BrowserWindow | null = null
let isQuitting = false

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow()
    mountManager.setMainWindow(mainWindow)
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.show()
  mainWindow.focus()
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 600,
    height: 500,
    show: false,
    frame: true,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.on('close', (e) => {
    if (isQuitting) return
    e.preventDefault()
    win.hide()
  })

  return win
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow()
  })

  app.whenReady().then(() => {
    mainWindow = createMainWindow()
    mountManager.setMainWindow(mainWindow)

    setupTray(mainWindow)
    setupIPC(mainWindow)
    setupAutoLauncher()

    connectionMonitor.start()

    // Initial status refresh
    mountManager.refreshAllStatuses()
  })

  app.on('activate', () => {
    showMainWindow()
  })
}

app.on('window-all-closed', () => {
  // Don't quit on window close - keep running in tray
})

app.on('before-quit', () => {
  isQuitting = true
  connectionMonitor.stop()
  mountManager.clearMainWindow()
})

export { mainWindow }
