import { AppSettings } from '../hooks/useConfig'
import { Locale, useI18n } from '../i18n'

interface SettingsPanelProps {
  settings?: AppSettings | null
  locale: Locale
  onClose: () => void
  onLanguageChange: (locale: Locale) => void
  onUpdateSettings: (settings: Partial<AppSettings>) => Promise<unknown>
}

export default function SettingsPanel({
  settings,
  locale,
  onClose,
  onLanguageChange,
  onUpdateSettings
}: SettingsPanelProps) {
  const { t } = useI18n()

  const handleOpenDiagnosticLog = async () => {
    const result = await window.api.openDiagnosticLogFile()
    if (!result.success && result.error) {
      console.error(t.errors.openDiagnosticLogFailed, result.error)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
      <div className="app-no-drag h-full w-full max-w-sm bg-white shadow-xl border-l border-gray-200 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{t.settingsPage.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            aria-label={t.cancel}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-200">
          <div className="p-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">{t.settingsPage.launchAtLogin}</h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings?.launchAtLogin || false}
                onChange={(event) => void onUpdateSettings({ launchAtLogin: event.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500" />
            </label>
          </div>

          <div className="p-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">{t.settingsPage.showNotifications}</h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings?.showNotifications || false}
                onChange={(event) => void onUpdateSettings({ showNotifications: event.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500" />
            </label>
          </div>

          <div className="p-4 space-y-2">
            <label className="block text-sm font-medium text-gray-900">
              {t.settingsPage.defaultMountPath}
            </label>
            <input
              type="text"
              value={settings?.defaultMountPath || '/Users/Shared/SMB'}
              onChange={(event) => void onUpdateSettings({ defaultMountPath: event.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="p-4 space-y-2">
            <label className="block text-sm font-medium text-gray-900">
              {t.settingsPage.checkInterval}
            </label>
            <input
              type="number"
              value={settings?.checkInterval || 30}
              onChange={(event) => void onUpdateSettings({ checkInterval: parseInt(event.target.value) || 30 })}
              min={5}
              max={300}
              className="w-24 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="p-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-900">{t.settingsPage.language}</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onLanguageChange('zh')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  locale === 'zh' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t.settingsPage.languageZh}
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange('en')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  locale === 'en' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t.settingsPage.languageEn}
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-gray-900">{t.settingsPage.diagnosticMode}</h3>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  {t.settingsPage.diagnosticModeHint}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={settings?.diagnosticMode || false}
                  onChange={(event) => void onUpdateSettings({ diagnosticMode: event.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500" />
              </label>
            </div>

            <button
              type="button"
              onClick={() => void handleOpenDiagnosticLog()}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t.settingsPage.openDiagnosticLog}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
