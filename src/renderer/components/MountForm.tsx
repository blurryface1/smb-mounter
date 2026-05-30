import React, { useState, useEffect } from 'react'
import { MountConfig } from '../hooks/useMounts'
import { useConfig } from '../hooks/useConfig'
import { useI18n } from '../i18n'

interface MountFormProps {
  mount?: MountConfig | null
  onSave: (data: FormData) => Promise<void>
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

export default function MountForm({ mount, onSave, onCancel }: MountFormProps) {
  const { t } = useI18n()
  const [formData, setFormData] = useState<FormData>(emptyForm)
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
        mountPath: settings?.defaultMountPath || '/Users/Shared/SMB'
      })
    }
  }, [mount, settings])

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
      const selectedPath = await window.api.selectDirectory()
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
      await onSave(formData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
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
              className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50"
            >
              {saving ? '...' : t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
