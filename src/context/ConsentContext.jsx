import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { readJson, writeJson } from '../lib/storage';
import { analyticsService } from '../services/analyticsService';

const ConsentContext = createContext(null);
const KEY = 'earthveda-consent-v1';
const VERSION = 1;
const isConsent = (v) =>
  v &&
  v.version === VERSION &&
  typeof v.analytics === 'boolean' &&
  typeof v.marketing === 'boolean';

/**
 * Cookie / storage consent (TDDDG § 25, GDPR). Only strictly necessary storage
 * is used until the visitor chooses. "Accept all" and "Necessary only" are
 * equally prominent, as German regulators require.
 */
export function ConsentProvider({ children }) {
  const [consent, setConsent] = useState(() => readJson(KEY, null, isConsent));
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    analyticsService.setConsent(Boolean(consent?.analytics));
    // Load analytics / marketing tags here once consent?.analytics / consent?.marketing is true.
  }, [consent]);

  const save = useCallback((choice) => {
    const value = {
      version: VERSION,
      analytics: Boolean(choice.analytics),
      marketing: Boolean(choice.marketing),
      at: new Date().toISOString(),
    };
    writeJson(KEY, value);
    setConsent(value);
    setPanelOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      consent,
      decided: Boolean(consent),
      panelOpen,
      openSettings: () => setPanelOpen(true),
      closeSettings: () => setPanelOpen(false),
      acceptAll: () => save({ analytics: true, marketing: true }),
      necessaryOnly: () => save({ analytics: false, marketing: false }),
      save,
    }),
    [consent, panelOpen, save],
  );
  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent() {
  const value = useContext(ConsentContext);
  if (!value) throw new Error('useConsent must be used inside <ConsentProvider>');
  return value;
}
