import React, { useState, useEffect } from 'react'
import { MountConfig } from '../hooks/useMounts'
import { useConfig } from '../hooks/useConfig'
import { useI18n } from '../i18n'
import { buildDiscoveredShareOption, getGeneratedMountPath } from '../ui/shareDiscoveryPresentation'
import { getMountDefaultName } from '../ui/mountPresentation'
import { DEFAULT_MOUNT_PATH } from '../../types'

interface MountFormProps {
  mount?: MountConfig | null
  mounts: MountConfig[]
  onSave: (data: FormData, options?: { mountAfterSave?: boolean }) => Promise<void>
  onCancel: () => void
}

interface FormData {
  name: string
  server: string
  shareName: string
  username: string
  password: string
  mountPath: string
  autoMount: boolean
  autoRetry: boolean
  retryInterval: number
}

interface FormSectionProps {
  title: string
  children: React.ReactNode
}

interface DiscoveredSMBServer {
  name: string
  serviceName: string
  host?: string
}

interface DiscoveredSMBShare {
  shareName: string
  isHidden: boolean
  isAdministrative: boolean
}

type FormMode = 'browse' | 'manual'

const emptyForm: FormData = {
  name: '',
  server: '',
  shareName: '',
  username: '',
  password: '',
  mountPath: '',
  autoMount: false,
  autoRetry: false,
  retryInterval: 30
}

function FormSection({ title, children }: FormSectionProps) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400">
        {title}
      </h3>
      <div className="space-y-4">
        {children}
      </div>
    </section>
  )
}

export default function MountForm({ mount, mounts, onSave, onCancel }: MountFormProps) {
  const { t } = useI18n()
  const [formData, setFormData] = useState<FormData>(emptyForm)
  const [mode, setMode] = useState<FormMode>(mount ? 'manual' : 'browse')
  const [servers, setServers] = useState<DiscoveredSMBServer[]>([])
  const [selectedServer, setSelectedServer] = useState('')
  const [shares, setShares] = useState<DiscoveredSMBShare[]>([])
  const [includeHidden, setIncludeHidden] = useState(false)
  const [discoveringServers, setDiscoveringServers] = useState(false)
  const [listingShares, setListingShares] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { settings } = useConfig()

  useEffect(() => {
    if (mount) {
      setFormData({
        name: mount.name,
        server: mount.server,
        shareName: mount.shareName,
        username: mount.username,
        password: '',
        mountPath: mount.mountPath,
        autoMount: mount.autoMount,
        autoRetry: mount.autoRetry,
        retryInterval: mount.retryInterval
      })
    } else {
      setFormData({
        ...emptyForm,
        mountPath: settings?.defaultMountPath || DEFAULT_MOUNT_PATH
      })
      setMode('browse')
      setSelectedServer('')
      setShares([])
    }
  }, [mount, settings])

  const discoverServers = async () => {
    setError(null)
    setDiscoveringServers(true)
    try {
      setServers(await window.api.discoverSMBServers())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover SMB servers')
    } finally {
      setDiscoveringServers(false)
    }
  }

  useEffect(() => {
    if (!mount) {
      void discoverServers()
    }
  }, [mount])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox'
        ? checked
        : type === 'number'
          ? Number(value)
          : value
    }))
  }

  const applySelectedDirectory = async (requireSystemMount: boolean) => {
    setError(null)

    try {
      const initialPath = formData.mountPath || settings?.defaultMountPath || DEFAULT_MOUNT_PATH
      const selectedPath = await window.api.selectDirectory(initialPath)
      if (!selectedPath) {
        return
      }

      const systemMount = await window.api.resolveSystemMountForPath(selectedPath)
      if (!systemMount) {
        if (requireSystemMount) {
          setError(t.form.chooseMountedShareHint)
          return
        }

        setFormData(prev => ({
          ...prev,
          mountPath: selectedPath
        }))
        return
      }

      setFormData(prev => {
        return {
          ...prev,
          name: prev.name.trim() ? prev.name : systemMount.shareName,
          server: systemMount.server,
          shareName: systemMount.shareName,
          username: systemMount.username,
          mountPath: systemMount.mountPath
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to choose directory')
    }
  }

  const handleChooseDirectory = () => {
    void applySelectedDirectory(false)
  }

  const handleChooseMountedShare = () => {
    void applySelectedDirectory(true)
  }

  const handleListShares = async () => {
    setError(null)

    if (!selectedServer.trim()) {
      setError(t.form.selectServer)
      return
    }

    if (!formData.username.trim()) {
      setError(t.form.username + ' is required')
      return
    }

    if (!formData.password) {
      setError(t.form.password + ' is required')
      return
    }

    setListingShares(true)
    try {
      const listedShares = await window.api.listSMBShares({
        server: selectedServer,
        username: formData.username,
        password: formData.password,
        includeHidden
      })
      setShares(listedShares)
    } catch {
      setError('Failed to list SMB shares')
    } finally {
      setListingShares(false)
    }
  }

  const handleSelectShare = (share: DiscoveredSMBShare) => {
    const defaultMountPath = settings?.defaultMountPath || DEFAULT_MOUNT_PATH
    const defaultName = getMountDefaultName(selectedServer, share.shareName, mounts)
    setFormData(prev => ({
      ...prev,
      name: prev.name.trim() ? prev.name : defaultName,
      server: selectedServer,
      shareName: share.shareName,
      mountPath: getGeneratedMountPath(defaultMountPath, share.shareName)
    }))
  }

  const saveForm = async (mountAfterSave: boolean) => {
    setError(null)

    if (!formData.name.trim()) {
      setError(t.form.name + ' is required')
      return
    }
    if (!formData.server.trim()) {
      setError(t.form.server + ' is required')
      return
    }
    if (!formData.shareName.trim()) {
      setError(t.form.shareName + ' is required')
      return
    }
    if (!formData.mountPath.trim()) {
      setError(t.form.mountPath + ' is required')
      return
    }

    if (!mount && !formData.password) {
      setError(t.form.password + ' is required')
      return
    }

    setSaving(true)
    try {
      await onSave(formData, { mountAfterSave })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void saveForm(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 dark:bg-black/70">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col dark:bg-gray-900">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            {mount ? t.form.editTitle : t.form.addTitle}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          {error && (
            <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          {!mount && (
            <div className="flex rounded-md border border-gray-200 p-1 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setMode('browse')}
                className={`flex-1 px-3 py-1.5 text-sm rounded transition-colors ${
                  mode === 'browse'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                {t.form.browseMode}
              </button>
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`flex-1 px-3 py-1.5 text-sm rounded transition-colors ${
                  mode === 'manual'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                {t.form.manualMode}
              </button>
            </div>
          )}

          {!mount && mode === 'browse' && (
            <FormSection title={t.form.discoverServers}>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t.form.discoveryHint}</p>

              <div className="flex gap-2">
                <select
                  value={selectedServer}
                  onChange={(event) => {
                    setSelectedServer(event.target.value)
                    setShares([])
                    setFormData(prev => ({
                      ...prev,
                      name: '',
                      server: '',
                      shareName: '',
                      mountPath: settings?.defaultMountPath || DEFAULT_MOUNT_PATH
                    }))
                  }}
                  className="min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                >
                  <option value="">{servers.length === 0 ? t.form.noServers : t.form.selectServer}</option>
                  {servers.map(server => (
                    <option key={server.serviceName} value={server.host ?? server.name}>
                      {server.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={discoverServers}
                  disabled={discoveringServers}
                  className="shrink-0 px-3 py-2 text-sm text-gray-700 border border-gray-300 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  {discoveringServers ? t.form.discoveringServers : t.refresh}
                </button>
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400">{t.form.credentialsHint}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">
                    {t.form.username}
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                    placeholder={t.form.username}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">
                    {t.form.password}
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                    placeholder={t.form.password}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={includeHidden}
                    onChange={(event) => setIncludeHidden(event.target.checked)}
                    className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                  />
                  {t.form.showHiddenShares}
                </label>
                <button
                  type="button"
                  onClick={handleListShares}
                  disabled={listingShares || !selectedServer}
                  className="px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50"
                >
                  {listingShares ? t.form.listingShares : t.form.listShares}
                </button>
              </div>

              {shares.length > 0 && (
                <div className="border border-gray-200 rounded-md overflow-hidden dark:border-gray-800">
                  {shares.map(share => {
                    const option = buildDiscoveredShareOption({
                      server: selectedServer,
                      shareName: share.shareName,
                      username: formData.username,
                      savedMounts: mounts
                    })
                    return (
                      <button
                        key={share.shareName}
                        type="button"
                        onClick={() => handleSelectShare(share)}
                        disabled={option.alreadySaved}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm border-b border-gray-100 last:border-b-0 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent dark:border-gray-800 dark:hover:bg-gray-800"
                      >
                        <span className="font-medium text-gray-900 dark:text-gray-100">{share.shareName}</span>
                        {option.alreadySaved && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{t.form.alreadySaved}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {formData.shareName && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">
                      {t.form.shareName}
                    </label>
                    <input
                      type="text"
                      name="shareName"
                      value={formData.shareName}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">
                      {t.form.localMountPoint}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="mountPath"
                        value={formData.mountPath}
                        onChange={handleChange}
                        className="min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                      />
                      <button
                        type="button"
                        onClick={handleChooseDirectory}
                        className="shrink-0 px-3 py-2 text-sm text-gray-700 border border-gray-300 hover:bg-gray-100 rounded-md transition-colors dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-800"
                      >
                        {t.form.chooseMountPath}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </FormSection>
          )}

          {(mount || mode === 'manual') && (
          <FormSection title={t.form.locationSection}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">
                {t.form.name}
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                placeholder={t.form.name}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">
                  {t.form.server}
                </label>
                <input
                  type="text"
                  name="server"
                  value={formData.server}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                  placeholder={t.form.serverPlaceholder}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">
                  {t.form.shareName}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="shareName"
                    value={formData.shareName}
                    onChange={handleChange}
                    className="min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                    placeholder={t.form.shareNamePlaceholder}
                  />
                  <button
                    type="button"
                    onClick={handleChooseMountedShare}
                    className="shrink-0 px-3 py-2 text-sm text-gray-700 border border-gray-300 hover:bg-gray-100 rounded-md transition-colors dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    {t.form.chooseMountedShare}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t.form.chooseMountedShareHint}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">
                {t.form.mountPath}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="mountPath"
                  value={formData.mountPath}
                  onChange={handleChange}
                  className="min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                  placeholder={t.form.mountPathPlaceholder}
                />
                <button
                  type="button"
                  onClick={handleChooseDirectory}
                  className="shrink-0 px-3 py-2 text-sm text-gray-700 border border-gray-300 hover:bg-gray-100 rounded-md transition-colors dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  {t.form.chooseMountPath}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t.form.chooseMountPathHint}</p>
            </div>
          </FormSection>
          )}

          {(mount || mode === 'manual') && (
          <FormSection title={t.form.credentialsSection}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">
                  {t.form.username}
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                  placeholder={t.form.username}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">
                  {t.form.password}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                  placeholder={mount ? t.form.passwordPlaceholderEdit : t.form.password}
                />
              </div>
            </div>
          </FormSection>
          )}

          <FormSection title={t.form.automationSection}>
            <div className="flex gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="autoMount"
                  checked={formData.autoMount}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">{t.form.autoMount}</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="autoRetry"
                  checked={formData.autoRetry}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">{t.form.autoRetry}</span>
              </label>
            </div>

            {formData.autoRetry && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-200">
                  {t.form.retryInterval}
                </label>
                <input
                  type="number"
                  name="retryInterval"
                  value={formData.retryInterval}
                  onChange={handleChange}
                  min={5}
                  max={300}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                />
              </div>
            )}
          </FormSection>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-md transition-colors disabled:opacity-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {saving ? '...' : (mount ? t.save : t.form.saveOnly)}
            </button>
            {!mount && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveForm(true)}
                className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50"
              >
                {saving ? '...' : t.form.saveAndMount}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
