import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { formatMoney } from '../../shared/markets.js';
import { langFromPath, matchRoute, path } from '../../shared/routes.js';
import { writeJson } from '../lib/storage';
import { messages } from './messages';
import { refreshCopy } from '../content/refreshCopy.js';

const LanguageContext = createContext(null);
export const LANG_KEY = 'earthveda-lang-v1';

function lookup(lang, key) {
  if (key.startsWith('refresh.'))
    return key
      .slice(8)
      .split('.')
      .reduce((node, part) => node?.[part], refreshCopy[lang]);
  return key.split('.').reduce((node, part) => (node == null ? node : node[part]), messages[lang]);
}

/**
 * Language comes from the URL (German at /, English at /en), so every page
 * has a shareable, indexable address per language.
 */
export function LanguageProvider({ children }) {
  const { pathname, search } = useLocation();
  const lang = langFromPath(pathname);

  useEffect(() => {
    document.documentElement.lang = lang;
    writeJson(LANG_KEY, lang);
  }, [lang]);

  const t = useCallback(
    (key, vars) => {
      let value = lookup(lang, key);
      if (vars && typeof vars.count === 'number') {
        const plural = lookup(lang, `${key}_${vars.count === 1 ? 'one' : 'other'}`);
        if (plural !== undefined) value = plural;
      }
      if (value === undefined) {
        if (import.meta.env.DEV) console.warn(`Missing translation: ${lang}.${key}`);
        return key;
      }
      if (typeof value !== 'string' || !vars) return value;
      return value.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? `{${name}}`);
    },
    [lang],
  );

  const value = useMemo(() => {
    const match = matchRoute(pathname);
    const other = lang === 'de' ? 'en' : 'de';
    return {
      lang,
      t,
      money: (cents) => formatMoney(cents, lang),
      to: (key, params) => path(key, lang, params),
      /** The same page in the other language (keeps query string). */
      switchPath: match ? `${path(match.key, other, match.params)}${search}` : path('home', other),
      other,
    };
  }, [lang, t, pathname, search]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useI18n must be used inside <LanguageProvider>');
  return value;
}

/** <L to="product" params={{ slug }}> renders a link in the current language. */
export function L({ to, params, query, nav = false, ...props }) {
  const { to: build } = useI18n();
  const href = `${build(to, params)}${query ? `?${new URLSearchParams(query)}` : ''}`;
  const Component = nav ? NavLink : Link;
  return <Component to={href} {...props} />;
}

/** Replace {placeholders} in a translated sentence with React nodes (e.g. links). */
export function Interpolate({ text, values }) {
  const parts = text.split(/(\{\w+\})/g);
  return parts.map((part, i) => {
    const m = part.match(/^\{(\w+)\}$/);
    return m && values[m[1]] !== undefined ? <span key={i}>{values[m[1]]}</span> : part;
  });
}
