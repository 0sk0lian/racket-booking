'use client';
import { useCallback, useEffect, useState } from 'react';
import { translations } from './translations';

type Locale = keyof typeof translations;
type TranslationKey = keyof (typeof translations)['sv'];

function detectLocale(): Locale {
  return 'sv';
}

export function useTranslation() {
  const [locale, setLocaleState] = useState<Locale>('sv');

  useEffect(() => {
    setLocaleState('sv');
    if (typeof window !== 'undefined') localStorage.setItem('locale', 'sv');
  }, []);

  const setLocale = useCallback((_l: Locale) => {
    setLocaleState('sv');
    localStorage.setItem('locale', 'sv');
  }, []);

  const t = useCallback(
    (key: TranslationKey, fallback?: string): string => {
      return translations[locale]?.[key] ?? translations['sv']?.[key] ?? fallback ?? key;
    },
    [locale],
  );

  return { t, locale, setLocale };
}
