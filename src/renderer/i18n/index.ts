// src/renderer/i18n/index.ts
import { useState, useCallback, useEffect } from 'react'
import { zh, en } from './locales'

export type Locale = 'zh' | 'en'
export type LocaleStrings = typeof zh

const locales: Record<Locale, LocaleStrings> = { zh, en }

const STORAGE_KEY = 'smb-mounter-language'
const LANGUAGE_CHANGE_EVENT = 'smb-mounter-language-changed'

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
    window.dispatchEvent(new CustomEvent<Locale>(LANGUAGE_CHANGE_EVENT, { detail: newLocale }))
  }, [])

  useEffect(() => {
    const handleLanguageChange = (event: Event) => {
      const nextLocale = (event as CustomEvent<Locale>).detail
      if (nextLocale === 'en' || nextLocale === 'zh') {
        setLocale(nextLocale)
      }
    }

    setLocale(getStoredLanguage())
    window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange)

    return () => {
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange)
    }
  }, [])

  return {
    locale,
    t,
    changeLanguage
  }
}

export { zh, en }
