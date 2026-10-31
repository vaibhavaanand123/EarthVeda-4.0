import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Seo from '../components/Seo';
import { L, useI18n } from '../i18n/LanguageContext';
import { shopApi } from '../services/shopApi';

/**
 * Confirmation / unsubscribe landing pages. A button click (not the email
 * link itself) performs the action, so mail scanners cannot trigger it.
 */
export default function Newsletter({ mode }) {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState('idle');
  const confirm = mode === 'confirm';

  const run = async () => {
    setState('sending');
    try {
      if (confirm) await shopApi.confirmNewsletter(token);
      else await shopApi.unsubscribe(token);
      setState('done');
    } catch {
      setState('invalid');
    }
  };

  return (
    <main className="page container narrow confirm">
      <Seo title={confirm ? t('newsletter.confirmTitle') : t('newsletter.unsubTitle')} noindex />
      <h1>{confirm ? t('newsletter.confirmTitle') : t('newsletter.unsubTitle')}</h1>
      {state === 'done' ? (
        <p role="status">{confirm ? t('newsletter.confirmed') : t('newsletter.unsubscribed')}</p>
      ) : state === 'invalid' || !token ? (
        <p role="alert">{t('newsletter.invalid')}</p>
      ) : (
        <>
          <p>{confirm ? t('newsletter.confirmLede') : t('newsletter.unsubLede')}</p>
          <button
            type="button"
            className="btn btn--ink btn--lg"
            onClick={run}
            disabled={state === 'sending'}
          >
            {confirm ? t('newsletter.confirmButton') : t('newsletter.unsubButton')}
          </button>
        </>
      )}
      <p>
        <L className="link" to="shop">
          {t('success.keepShopping')}
        </L>
      </p>
    </main>
  );
}
