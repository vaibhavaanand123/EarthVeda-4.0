import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { localiseProduct } from '../../shared/catalog.js';
import { useI18n } from '../i18n/LanguageContext';
import { shopApi } from '../services/shopApi';
import { config } from '../config';
import { PREVIEW_STORE } from '../content/previewStore.js';

const StoreContext = createContext(null);

/**
 * Live catalogue and store settings from the API (managed in the admin).
 * Products are exposed already translated for the current language.
 */
export function StoreProvider({ children }) {
  const { lang } = useI18n();
  const [state, setState] = useState(() => ({
    data: config.preview ? PREVIEW_STORE : null,
    loading: !config.preview,
    error: false,
  }));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (config.preview) return undefined;
    const controller = new AbortController();
    shopApi
      .storefront({ signal: controller.signal, fresh: attempt > 0 })
      .then((data) => setState({ data, loading: false, error: false }))
      .catch(() => {
        if (!controller.signal.aborted) setState((s) => ({ ...s, loading: false, error: true }));
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: false }));
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo(() => {
    const raw = state.data?.products ?? [];
    const products = raw.map((p) => localiseProduct(p, lang));
    const byId = new Map(products.map((p) => [p.id, p]));
    const rawById = new Map(raw.map((p) => [p.id, p]));
    const bundles = state.data?.bundles ?? [];
    const bundleById = new Map(bundles.map((b) => [b.id, b]));
    return {
      loading: state.loading,
      preview: config.preview,
      error: state.error,
      retry,
      products,
      foxnuts: products.filter((p) => p.range === 'foxnuts'),
      protein: products.filter((p) => p.range === 'protein'),
      bundles,
      shipping: state.data?.shipping ?? {},
      story: state.data?.story?.[lang] ?? null,
      business: state.data?.business ?? {},
      newsletter: state.data?.newsletter ?? {},
      product: (id) => byId.get(id) ?? null,
      bySlug: (slug) => products.find((p) => p.slug === slug) ?? null,
      bundle: (id) => bundleById.get(id) ?? null,
      /** Untranslated resolvers for the shared pricing engine. */
      resolveProduct: (id) => rawById.get(id) ?? null,
      resolveBundle: (id) => bundleById.get(id) ?? null,
    };
  }, [state, retry, lang]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside <StoreProvider>');
  return value;
}
