import { useState, useEffect, useCallback } from 'react'

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

    const unsubscribeStatusChanged = window.api.onMountStatusChanged((data) => {
      setStatuses(prev => {
        const next = new Map(prev)
        next.set(data.configId, data.status)
        return next
      })
    })

    const unsubscribeRefreshAll = window.api.onRefreshAllMounts(() => {
      loadMounts()
    })

    return () => {
      unsubscribeStatusChanged()
      unsubscribeRefreshAll()
    }
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
