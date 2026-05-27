import React, { useState } from 'react'
import { useMounts } from '../hooks/useMounts'
import { useConfig } from '../hooks/useConfig'
import { MountConfig } from '../hooks/useMounts'
import MountList from './MountList'
import MountForm from './MountForm'
import { useI18n, Locale } from '../i18n'

type View = 'mounts' | 'settings'

export default function SettingsWindow() {
  const { t, locale, changeLanguage } = useI18n()
  const { mounts, statuses, loading, addMount, updateMount, deleteMount, mount, unmount, retry, refresh } = useMounts()
  const { settings, updateSettings } = useConfig()

  const [view, setView] = useState<View>('mounts')
  const [showForm, setShowForm] = useState(false)
  const [editingMount, setEditingMount] = useState<MountConfig | null>(null)

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

  const handleDelete = async (id: string) => {
    await deleteMount(id)
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

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">{t.appName}</h1>
        </div>

        <nav className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView('mounts')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              view === 'mounts' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.add}
          </button>
          <button
            onClick={() => setView('settings')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              view === 'settings' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.settings}
          </button>
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-4">
        {view === 'mounts' ? (
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                {t.add}
              </h2>
              <button
                onClick={handleAddNew}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t.add}
              </button>
            </div>

            <MountList
              mounts={mounts}
              statuses={statuses}
              loading={loading}
              onMount={handleMount}
              onUnmount={handleUnmount}
              onRetry={handleRetry}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <h2 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-4">
              {t.settingsPage.title}
            </h2>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
              <div className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{t.settingsPage.launchAtLogin}</h3>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings?.launchAtLogin || false}
                    onChange={(e) => updateSettings({ launchAtLogin: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
              </div>

              <div className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{t.settingsPage.showNotifications}</h3>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings?.showNotifications || false}
                    onChange={(e) => updateSettings({ showNotifications: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-gray-900">{t.settingsPage.defaultMountPath}</h3>
                  </div>
                </div>
                <input
                  type="text"
                  value={settings?.defaultMountPath || '/Volumes/SMB'}
                  onChange={(e) => updateSettings({ defaultMountPath: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-gray-900">{t.settingsPage.checkInterval}</h3>
                  </div>
                </div>
                <input
                  type="number"
                  value={settings?.checkInterval || 30}
                  onChange={(e) => updateSettings({ checkInterval: parseInt(e.target.value) || 30 })}
                  min={5}
                  max={300}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{t.settingsPage.language}</h3>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleLanguageChange('zh')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      locale === 'zh' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {t.settingsPage.languageZh}
                  </button>
                  <button
                    onClick={() => handleLanguageChange('en')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      locale === 'en' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {t.settingsPage.languageEn}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <button
                onClick={refresh}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t.refresh}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modal */}
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
    </div>
  )
}