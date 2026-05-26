import { useState, useEffect, useCallback } from 'react'

declare global {
  interface Window {
    api: {
      getMounts: () => Promise<any[]>
      addMount: (mount: any) => Promise<any>
      updateMount: (id: string, updates: any) => Promise<any>
      deleteMount: (id: string) => Promise<boolean>
      mount: (id: string) => Promise<{ success: boolean; error?: string }>
      unmount: (id: string) => Promise<{ success: boolean; error?: string }>
      retryMount: (id: string) => Promise<{ success: boolean; error?: string }>
      getAllStatuses: () => Promise<any[]>
      refreshAllStatuses: () => Promise<any[]>
      onMountStatusChanged: (callback: (data: any) => void) => void
      onRefreshAllMounts: (callback: () => void) => void
    }
  }
}

export interface MountConfig {
  id: string
  name: string
  server: string
  shareName: string
  username: string
  mountPath: string
  autoMount: boolean
  autoRetry: boolean
  retryInterval: number
}

export interface MountStatus {
  configId: string
  status: 'mounted' | 'disconnected' | 'error' | 'pending'
  lastChecked: number
  retryCount: number
  errorMessage?: string
}

export function useMounts() {
  const [mounts, setMounts] = useState<MountConfig[]>([])
  const [statuses, setStatuses] = useState<Map<string, MountStatus>>(new Map())
  const [loading, setLoading] = useState(true)

  const loadMounts = useCallback(async () => {
    try {
      const data = await window.api.getMounts()
      setMounts(data)

      const statusData = await window.api.getAllStatuses()
      const statusMap = new Map<string, MountStatus>()
      statusData.forEach(s => statusMap.set(s.configId, s))
      setStatuses(statusMap)
    } catch (error) {
      console.error('Failed to load mounts:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMounts()

    window.api.onMountStatusChanged((data) => {
      setStatuses(prev => {
        const next = new Map(prev)
        next.set(data.configId, data.status)
        return next
      })
    })

    window.api.onRefreshAllMounts(() => {
      loadMounts()
    })
  }, [loadMounts])

  const addMount = async (mount: Omit<MountConfig, 'id'> & { password: string }) => {
    const result = await window.api.addMount(mount)
    await loadMounts()
    return result
  }

  const updateMount = async (id: string, updates: Partial<MountConfig> & { password?: string }) => {
    const result = await window.api.updateMount(id, updates)
    await loadMounts()
    return result
  }

  const deleteMount = async (id: string) => {
    const result = await window.api.deleteMount(id)
    await loadMounts()
    return result
  }

  const mount = async (id: string) => window.api.mount(id)
  const unmount = async (id: string) => window.api.unmount(id)
  const retry = async (id: string) => window.api.retryMount(id)

  return {
    mounts, statuses, loading,
    addMount, updateMount, deleteMount,
    mount, unmount, retry,
    refresh: loadMounts
  }
}