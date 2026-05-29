import type { AppSettings } from '../hooks/useConfig'
import type { MountConfig, MountStatus } from '../hooks/useMounts'

interface SystemMount {
  server: string
  shareName: string
  username: string
  mountPath: string
}

interface MountOperationResult {
  success: boolean
  error?: string
}

interface MountStatusChangedEvent {
  configId: string
  status: MountStatus
}

declare global {
  interface Window {
    api: {
      getConfig: () => Promise<unknown>
      getMounts: () => Promise<MountConfig[]>
      addMount: (mount: Omit<MountConfig, 'id'> & { password: string }) => Promise<MountConfig>
      updateMount: (id: string, updates: Partial<MountConfig> & { password?: string }) => Promise<MountConfig | null>
      deleteMount: (id: string) => Promise<boolean>
      getSettings: () => Promise<AppSettings>
      updateSettings: (updates: Partial<AppSettings>) => Promise<AppSettings>
      mount: (id: string) => Promise<MountOperationResult>
      unmount: (id: string) => Promise<MountOperationResult>
      retryMount: (id: string) => Promise<MountOperationResult>
      getMountStatus: (id: string) => Promise<MountStatus | undefined>
      getAllStatuses: () => Promise<MountStatus[]>
      refreshStatus: (id: string) => Promise<MountStatus | null>
      refreshAllStatuses: () => Promise<MountStatus[]>
      detectSystemMounts: () => Promise<SystemMount[]>
      selectDirectory: () => Promise<string | null>
      resolveSystemMountForPath: (selectedPath: string) => Promise<SystemMount | null>
      openPathInFinder: (mountPath: string) => Promise<MountOperationResult>
      onMountStatusChanged: (callback: (data: MountStatusChangedEvent) => void) => () => void
      onRefreshAllMounts: (callback: () => void) => () => void
    }
  }
}

export {}
