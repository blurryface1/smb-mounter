// src/renderer/i18n/index.ts
import { useState, useCallback, useEffect } from 'react'
import { zh, en, Locale, LocaleStrings } from './locales'

const locales: Record<Locale, LocaleStrings> = { zh, en }

const STORAGE_KEY = 'smb-mounter-language'

function getStoredLanguage(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'zh') {
    return stored
  }
  return 'zh' // Default to Chinese
}

function storeLanguage(locale: Locale): void {
  localStorage.setItem(STORAGE_KEY, locale)
}

export function useI18n() {
  const [locale, setLocale] = useState<Locale>(getStoredLanguage())

  const t = locales[locale]

  const changeLanguage = useCallback((newLocale: Locale) => {
    setLocale(newLocale)
    storeLanguage(newLocale)
  }, [])

  useEffect(() => {
    // Sync with localStorage on mount
    setLocale(getStoredLanguage())
  }, [])

  return {
    locale,
    t,
    changeLanguage
  }
}

export { zh, en, Locale, LocaleStrings }