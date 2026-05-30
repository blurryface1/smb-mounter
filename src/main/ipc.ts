// src/main/ipc.ts
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { isAbsolute, normalize } from 'path'
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
import { detectSystemSMBMounts, DetectedMount } from '../core/detectMounts'
import { findMountForSelectedPath } from '../core/systemMountMatcher'
import { setLaunchAtLogin } from './autoLauncher'
import { diagnosticLog, openDiagnosticLogFile } from '../core/diagnosticLogger'

function normalizeCheckInterval(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return Math.min(Math.max(Math.round(value), 5), 300)
}

function normalizeDefaultMountPath(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const mountPath = normalize(value.trim())
  if (!isAbsolute(mountPath) || mountPath === '/') {
    return null
  }

  return mountPath
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeAbsolutePath(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null
  }

  const normalizedPath = normalize(value.trim())
  return isAbsolute(normalizedPath) ? normalizedPath : null
}

function removeTrailingSlash(path: string): string {
  return path === '/' ? path : path.replace(/\/+$/, '')
}

function isPathInsideMountPath(mountPath: string, candidatePath: string): boolean {
  const normalizedMountPath = normalizeAbsolutePath(mountPath)
  if (!normalizedMountPath || normalizedMountPath === '/') {
    return false
  }

  const mountRoot = removeTrailingSlash(normalizedMountPath)
  const candidate = removeTrailingSlash(candidatePath)
  return candidate === mountRoot || candidate.startsWith(`${mountRoot}/`)
}

function isAllowedSMBPath(normalizedPath: string): boolean {
  const mountPaths = [
    ...getMounts().map(mount => mount.mountPath),
    ...detectSystemSMBMounts().map(mount => mount.mountPath)
  ]

  return mountPaths.some(mountPath => isPathInsideMountPath(mountPath, normalizedPath))
}

export function setupIPC(mainWindow: BrowserWindow): void {
  // Config operations
  ipcMain.handle('get-config', () => loadConfig())
  ipcMain.handle('get-mounts', () => getMounts())
  ipcMain.handle('add-mount', (_, mount) => addMount(mount))
  ipcMain.handle('update-mount', (_, id, updates) => updateMount(id, updates))
  ipcMain.handle('delete-mount', (_, id) => deleteMount(id))
  ipcMain.handle('get-settings', () => getSettings())
  ipcMain.handle('update-settings', async (_, updates) => {
    const safeUpdates = isRecord(updates) ? updates : {}
    const { launchAtLogin, checkInterval, ...otherUpdates } = safeUpdates
    const previousSettings = getSettings()
    const sanitizedUpdates = { ...otherUpdates }

    if (typeof sanitizedUpdates.defaultMountPath !== 'undefined') {
      const normalizedDefaultMountPath = normalizeDefaultMountPath(sanitizedUpdates.defaultMountPath)
      if (normalizedDefaultMountPath) {
        sanitizedUpdates.defaultMountPath = normalizedDefaultMountPath
      } else {
        delete sanitizedUpdates.defaultMountPath
      }
    }

    if (
      typeof sanitizedUpdates.theme !== 'undefined' &&
      sanitizedUpdates.theme !== 'system' &&
      sanitizedUpdates.theme !== 'light' &&
      sanitizedUpdates.theme !== 'dark'
    ) {
      delete sanitizedUpdates.theme
    }

    for (const booleanKey of ['showNotifications', 'diagnosticMode']) {
      if (typeof sanitizedUpdates[booleanKey] !== 'undefined' && typeof sanitizedUpdates[booleanKey] !== 'boolean') {
        delete sanitizedUpdates[booleanKey]
      }
    }

    if (typeof sanitizedUpdates.diagnosticMode === 'boolean' && !sanitizedUpdates.diagnosticMode) {
      await diagnosticLog('info', 'diagnosticMode.disabled')
    }

    if (Object.keys(sanitizedUpdates).length > 0) {
      updateSettings(sanitizedUpdates)
      if (sanitizedUpdates.diagnosticMode === true) {
        await diagnosticLog('info', 'diagnosticMode.enabled')
      }
    }

    if (typeof launchAtLogin === 'boolean') {
      await setLaunchAtLogin(launchAtLogin)
    }

    const normalizedCheckInterval = normalizeCheckInterval(checkInterval)
    if (normalizedCheckInterval !== null) {
      updateSettings({ checkInterval: normalizedCheckInterval })
      if (normalizedCheckInterval !== previousSettings.checkInterval) {
        connectionMonitor.restart()
      }
    }

    return getSettings()
  })

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

  // Detect system mounts
  ipcMain.handle('detect-system-mounts', (): DetectedMount[] => detectSystemSMBMounts())

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    })

    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('resolve-system-mount-for-path', (_, selectedPath: string) => {
    if (typeof selectedPath !== 'string' || selectedPath.trim().length === 0) {
      return null
    }

    return findMountForSelectedPath(detectSystemSMBMounts(), selectedPath)
  })

  ipcMain.handle('open-path-in-finder', async (_, mountPath: string) => {
    const normalizedPath = normalizeAbsolutePath(mountPath)
    if (!normalizedPath) {
      return { success: false, error: 'Mount path is required' }
    }

    if (!isAllowedSMBPath(normalizedPath)) {
      return { success: false, error: 'Path is not a configured or detected SMB mount' }
    }

    const error = await shell.openPath(normalizedPath)
    return error ? { success: false, error } : { success: true }
  })

  ipcMain.handle('open-diagnostic-log-file', async () => {
    const result = await openDiagnosticLogFile()
    await diagnosticLog(result.success ? 'info' : 'error', 'diagnosticLog.open', {
      success: result.success,
      error: result.error
    })
    return result
  })
}
