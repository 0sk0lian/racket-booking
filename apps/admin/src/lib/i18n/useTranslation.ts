'use client';
import { useCallback, useEffect, useState } from 'react';
import { translations } from './translations';

type Locale = keyof typeof translations;
type TranslationKey = keyof (typeof translations)['sv'];

function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'sv';
  const stored = localStorage.getItem('locale');
  if (stored === 'sv' || stored === 'en') return stored;
  const browser = navigator.language.slice(0, 2);
  return browser === 'en' ? 'en' : 'sv';
}

export function useTranslation() {
  const [locale, setLocaleState] = useState<Locale>('sv');

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('locale', l);
  }, []);

  const t = useCallback(
    (key: TranslationKey, fallback?: string): string => {
      return translations[locale]?.[key] ?? translations['sv']?.[key] ?? fallback ?? key;
    },
    [locale],
  );

  return { t, locale, setLocale };
}
