/// <reference types="vite/client" />

import { useEffect, useState } from 'react'
import { useMounts } from '../hooks/useMounts'
import { useConfig } from '../hooks/useConfig'
import { MountConfig } from '../hooks/useMounts'
import MountList from './MountList'
import MountForm from './MountForm'
import ImportMountsModal from './ImportMountsModal'
import SettingsPanel from './SettingsPanel'
import { useI18n, Locale } from '../i18n'
import { getMountIdentityKey } from '../../core/mountIdentity'
import { getMountSummary } from '../ui/mountPresentation'
import windowIcon from '../assets/windowIcon.png'

export default function SettingsWindow() {
  const { t, locale, changeLanguage } = useI18n()
  const { mounts, statuses, loading, addMount, updateMount, deleteMount, mount, unmount, retry, refresh } = useMounts()
  const { settings, updateSettings } = useConfig()

  const [showForm, setShowForm] = useState(false)
  const [editingMount, setEditingMount] = useState<MountConfig | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    const theme = settings?.theme ?? 'system'
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      const shouldUseDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches)
      document.documentElement.classList.toggle('dark', shouldUseDark)
      document.documentElement.style.colorScheme = shouldUseDark ? 'dark' : 'light'
    }

    applyTheme()

    if (theme !== 'system') {
      return undefined
    }

    mediaQuery.addEventListener('change', applyTheme)
    return () => mediaQuery.removeEventListener('change', applyTheme)
  }, [settings?.theme])

  const summary = getMountSummary(mounts, Array.from(statuses.values()))
  const summaryItems = summary.total === 0
    ? [t.summary.empty]
    : [
        t.summary.mounted.replace('{count}', String(summary.mounted)),
        t.summary.errors.replace('{count}', String(summary.errors)),
        t.summary.autoRetry.replace('{count}', String(summary.autoRetry))
      ]

  const handleAddNew = () => {
    setEditingMount(null)
    setShowForm(true)
  }

  const handleEdit = (mountConfig: MountConfig) => {
    setEditingMount(mountConfig)
    setShowForm(true)
  }

  const handleSave = async (data: any) => {
    if (editingMount) {
      await updateMount(editingMount.id, data)
    } else {
      await addMount(data)
    }
    setShowForm(false)
    setEditingMount(null)
  }

  const handleDelete = async (mountConfig: MountConfig) => {
    if (!window.confirm(t.confirmDelete)) {
      return
    }

    const currentStatus = statuses.get(mountConfig.id)?.status || 'disconnected'
    if (currentStatus === 'mounted' && window.confirm(t.confirmUnmountOnDelete)) {
      const result = await unmount(mountConfig.id)
      if (!result.success && result.error) {
        console.error(t.errors.unmountFailed, result.error)
        return
      }
    }

    await deleteMount(mountConfig.id)
  }

  const handleOpenInFinder = async (mountConfig: MountConfig) => {
    const result = await window.api.openPathInFinder(mountConfig.mountPath)
    if (!result.success && result.error) {
      console.error(t.errors.openInFinderFailed, result.error)
    }
  }

  const handleMount = async (id: string) => {
    const result = await mount(id)
    if (!result.success && result.error) {
      console.error(t.errors.mountFailed, result.error)
    }
  }

  const handleUnmount = async (id: string) => {
    const result = await unmount(id)
    if (!result.success && result.error) {
      console.error(t.errors.unmountFailed, result.error)
    }
  }

  const handleRetry = async (id: string) => {
    const result = await retry(id)
    if (!result.success && result.error) {
      console.error(t.errors.retryFailed, result.error)
    }
  }

  const handleLanguageChange = (newLocale: Locale) => {
    changeLanguage(newLocale)
  }

  const handleImport = async (detectedMounts: any[]) => {
    const existingKeys = new Set(mounts.map(mountConfig => getMountIdentityKey(mountConfig)))

    for (const mount of detectedMounts) {
      const key = getMountIdentityKey(mount)
      if (existingKeys.has(key)) {
        continue
      }

      await addMount({
        name: mount.shareName,
        server: mount.server,
        shareName: mount.shareName,
        username: mount.username,
        mountPath: mount.mountPath,
        password: '',
        autoMount: false,
        autoRetry: false,
        retryInterval: 30
      })
      existingKeys.add(key)
    }
    setShowImportModal(false)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="app-drag-region bg-white border-b border-gray-200 pl-20 pr-4 py-3 min-h-[58px] flex items-center justify-between dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-center gap-3 min-w-0">
          <img src={windowIcon} alt="" className="w-7 h-7 shrink-0" draggable={false} />
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900 truncate dark:text-gray-50">{t.appName}</h1>
            <p className="text-xs text-gray-500 truncate dark:text-gray-400">{summaryItems.join(' · ')}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="app-no-drag p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
          title={t.settings}
          aria-label={t.settings}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      <main className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-700 uppercase tracking-wide dark:text-gray-300">
              {t.mounts}
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={refresh}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-md transition-colors dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t.refresh}
              </button>
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-md transition-colors dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {t.import.title}
              </button>
              <button
                type="button"
                onClick={handleAddNew}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t.add}
              </button>
            </div>
          </div>

          <MountList
            mounts={mounts}
            statuses={statuses}
            loading={loading}
            onMount={handleMount}
            onUnmount={handleUnmount}
            onRetry={handleRetry}
            onEdit={handleEdit}
            onOpenInFinder={handleOpenInFinder}
            onDelete={handleDelete}
          />
        </div>
      </main>

      {showForm && (
        <MountForm
          mount={editingMount}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false)
            setEditingMount(null)
          }}
        />
      )}

      {showSettings && (
        <SettingsPanel
          settings={settings}
          locale={locale}
          onClose={() => setShowSettings(false)}
          onLanguageChange={handleLanguageChange}
          onUpdateSettings={updateSettings}
        />
      )}

      {showImportModal && (
        <ImportMountsModal
          onImport={handleImport}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  )
}
