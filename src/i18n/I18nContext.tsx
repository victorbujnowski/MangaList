import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { translations, LANGS, LANG_LABELS, type Lang, type TranslationKey } from './translations';

const STORAGE_KEY = 'mangalist_lang';

export type TFunction = (key: TranslationKey, vars?: Record<string, string | number>) => string;

interface I18nValue {
  lang: Lang;
  locale: string;
  setLang: (lang: Lang) => void;
  t: TFunction;
}

function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as readonly string[]).includes(v);
}

/** Idioma inicial: preferência salva → idioma do navegador → inglês. */
export function detectInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* localStorage indisponível */
  }
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
  if (nav.startsWith('pt')) return 'pt';
  if (nav.startsWith('es')) return 'es';
  return 'en';
}

/** Interpola {var}; cai para o inglês e, por fim, para a própria chave. */
export function translate(lang: Lang, key: TranslationKey, vars?: Record<string, string | number>): string {
  let s = translations[lang][key] ?? translations.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang);

  useEffect(() => {
    document.documentElement.lang = LANG_LABELS[lang].locale;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    if (!isLang(next)) return;
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback<TFunction>((key, vars) => translate(lang, key, vars), [lang]);

  const value = useMemo(() => ({ lang, locale: LANG_LABELS[lang].locale, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n precisa estar dentro de <I18nProvider>');
  return ctx;
}
