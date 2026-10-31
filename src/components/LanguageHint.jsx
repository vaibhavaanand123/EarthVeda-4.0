import { X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/LanguageContext';
import { readJson, writeJson } from '../lib/storage';

const KEY = 'earthveda-langhint-v1';

/**
 * Non-German browsers landing on a German page get a one-time suggestion to
 * switch (we never auto-redirect: better for SEO and less surprising).
 */
export default function LanguageHint() {
  const { lang, switchPath } = useI18n();
  const [dismissed, setDismissed] = useState(() => readJson(KEY, false));
  const browserLang =
    typeof navigator === 'undefined' ? 'de' : (navigator.language || 'de').slice(0, 2);
  if (dismissed || lang !== 'de' || browserLang === 'de') return null;
  const close = () => {
    writeJson(KEY, true);
    setDismissed(true);
  };
  return (
    <div className="langhint" lang="en">
      <p className="container">
        <span>This page is in German.</span>
        <Link to={switchPath} onClick={close} hrefLang="en">
          View in English
        </Link>
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          onClick={close}
          aria-label="Dismiss"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </p>
    </div>
  );
}
