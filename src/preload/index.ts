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
  detectSystemMounts: () => ipcRenderer.invoke('detect-system-mounts'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  resolveSystemMountForPath: (selectedPath: string) => ipcRenderer.invoke('resolve-system-mount-for-path', selectedPath),
  openPathInFinder: (mountPath: string) => ipcRenderer.invoke('open-path-in-finder', mountPath),

  // Events
  onMountStatusChanged: (callback: (data: any) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on('mount-status-changed', listener)
    return () => ipcRenderer.removeListener('mount-status-changed', listener)
  },
  onRefreshAllMounts: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('refresh-all-mounts', listener)
    return () => ipcRenderer.removeListener('refresh-all-mounts', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
