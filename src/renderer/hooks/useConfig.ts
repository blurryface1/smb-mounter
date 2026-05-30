import { useState, useEffect, useCallback } from 'react'

export interface AppSettings {
  launchAtLogin: boolean
  showNotifications: boolean
  defaultMountPath: string
  checkInterval: number
  diagnosticMode: boolean
  theme: 'system' | 'light' | 'dark'
}

export function useConfig() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const loadSettings = useCallback(async () => {
    try {
      const data = await window.api.getSettings()
      setSettings(data)
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const updateSettings = async (updates: Partial<AppSettings>) => {
    const result = await window.api.updateSettings(updates)
    setSettings(result)
    return result
  }

  return { settings, updateSettings, refresh: loadSettings, loading }
}
