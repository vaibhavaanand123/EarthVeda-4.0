import { useConsent } from '../context/ConsentContext';
import { L, useI18n } from '../i18n/LanguageContext';

/** No optional trackers are installed, so no intrusive consent prompt is needed. */
export default function CookieBanner() {
  const { t } = useI18n();
  const consent = useConsent();
  if (!consent.panelOpen) return null;
  return (
    <section className="cookie privacy-note" role="region" aria-label={t('refresh.legal.privacy')}>
      <h2 className="cookie__title">{t('refresh.legal.privacy')}</h2>
      <p>
        {t('refresh.legal.essential')} <L to="privacy">{t('footer.privacy')}</L>
      </p>
      <div className="cookie__actions">
        <button type="button" className="btn btn--ink" onClick={consent.necessaryOnly}>
          {t('common.close')}
        </button>
      </div>
    </section>
  );
}
