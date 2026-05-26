// src/main/ipc.ts
import { BrowserWindow, ipcMain } from 'electron'
import { mountManager } from '../core/mountManager'
import { connectionMonitor } from '../core/connectionMonitor'
import {
  loadConfig,
  getMounts,
  addMount,
  updateMount,
  deleteMount,
  getSettings,
  updateSettings
} from '../core/configStore'

export function setupIPC(mainWindow: BrowserWindow): void {
  // Config operations
  ipcMain.handle('get-config', () => loadConfig())
  ipcMain.handle('get-mounts', () => getMounts())
  ipcMain.handle('add-mount', (_, mount) => addMount(mount))
  ipcMain.handle('update-mount', (_, id, updates) => updateMount(id, updates))
  ipcMain.handle('delete-mount', (_, id) => deleteMount(id))
  ipcMain.handle('get-settings', () => getSettings())
  ipcMain.handle('update-settings', (_, updates) => updateSettings(updates))

  // Mount operations
  ipcMain.handle('mount', (_, configId) => mountManager.mount(configId))
  ipcMain.handle('unmount', (_, configId) => mountManager.unmount(configId))
  ipcMain.handle('retry-mount', (_, configId) => mountManager.retryMount(configId))
  ipcMain.handle('get-mount-status', (_, configId) => mountManager.getStatus(configId))
  ipcMain.handle('get-all-statuses', () => mountManager.getAllStatuses())

  ipcMain.handle('refresh-status', (_, configId) => {
    const mount = getMounts().find(m => m.id === configId)
    return mount ? mountManager.refreshStatus(mount) : null
  })

  ipcMain.handle('refresh-all-statuses', async () => {
    await mountManager.refreshAllStatuses()
    return mountManager.getAllStatuses()
  })

  // Connection monitor
  ipcMain.handle('check-and-remount', () => connectionMonitor.checkAndRemount())
}
