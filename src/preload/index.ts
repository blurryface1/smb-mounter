// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  getMounts: () => ipcRenderer.invoke('get-mounts'),
  addMount: (mount: any) => ipcRenderer.invoke('add-mount', mount),
  updateMount: (id: string, updates: any) => ipcRenderer.invoke('update-mount', id, updates),
  deleteMount: (id: string) => ipcRenderer.invoke('delete-mount', id),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (updates: any) => ipcRenderer.invoke('update-settings', updates),

  // Mount operations
  mount: (configId: string) => ipcRenderer.invoke('mount', configId),
  unmount: (configId: string) => ipcRenderer.invoke('unmount', configId),
  retryMount: (configId: string) => ipcRenderer.invoke('retry-mount', configId),
  getMountStatus: (configId: string) => ipcRenderer.invoke('get-mount-status', configId),
  getAllStatuses: () => ipcRenderer.invoke('get-all-statuses'),
  refreshStatus: (configId: string) => ipcRenderer.invoke('refresh-status', configId),
  refreshAllStatuses: () => ipcRenderer.invoke('refresh-all-statuses'),

  // Events
  onMountStatusChanged: (callback: (data: any) => void) => {
    ipcRenderer.on('mount-status-changed', (_, data) => callback(data))
  },
  onRefreshAllMounts: (callback: () => void) => {
    ipcRenderer.on('refresh-all-mounts', () => callback())
  }
}

contextBridge.exposeInMainWorld('api', api)
