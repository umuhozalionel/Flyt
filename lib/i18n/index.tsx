"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react"
import { useStored } from "../use-stored"
import type { Language } from "../types"
import en, { type TranslationKey } from "./en"
import fr from "./fr"
import rw from "./rw"

export type { TranslationKey }
export type TranslateVars = Record<string, string | number>

const dictionaries: Record<Language, Partial<Record<TranslationKey, string>>> = { en, rw, fr }
export const languages: { id: Language; label: string }[] = [
  { id: "en", label: "English" },
  { id: "rw", label: "Kinyarwanda" },
  { id: "fr", label: "Français" },
]

/** Look up a UI string. Missing Kinyarwanda or French strings fall back to English. */
export function translate(language: Language, key: TranslationKey, vars?: TranslateVars) {
  const text = dictionaries[language][key] ?? en[key]
  return vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : text
}

const STORAGE_KEY = "flyt-language"
const I18nContext = createContext<{ language: Language; setLanguage: (language: Language) => void }>({ language: "en", setLanguage: () => undefined })
const isLanguage = (value: string): value is Language => value in dictionaries

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useStored<Language>(STORAGE_KEY, "en", isLanguage)
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])
  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useLanguage() {
  return useContext(I18nContext)
}

/** t(key, vars) for the current language. */
export function useT() {
  const { language } = useContext(I18nContext)
  return useCallback((key: TranslationKey, vars?: TranslateVars) => translate(language, key, vars), [language])
}
