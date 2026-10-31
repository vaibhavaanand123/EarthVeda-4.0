import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Seo from '../components/Seo';
import { useI18n } from '../i18n/LanguageContext';
import { shopApi } from '../services/shopApi';

/** Development stand-in for the Stripe payment page (mock provider only). */
export default function MockPay() {
  const { t, to } = useI18n();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const session = params.get('session') || '';
  const order = params.get('order') || '';

  const run = async (outcome) => {
    setBusy(true);
    try {
      await shopApi.mockPayment(session, outcome);
    } finally {
      setBusy(false);
    }
    if (outcome === 'success')
      navigate(`${to('orderSuccess')}?order=${order}&session_id=${session}`);
    else navigate(`${to('checkout')}?cancelled=${order}`);
  };

  return (
    <main className="page container narrow mockpay">
      <Seo title={t('mockPay.title')} noindex />
      <h1>{t('mockPay.title')}</h1>
      <p className="notice">{t('mockPay.note')}</p>
      <p>
        <strong>{order}</strong>
      </p>
      <div className="confirm__actions">
        <button
          type="button"
          className="btn btn--ink"
          disabled={busy}
          onClick={() => run('success')}
        >
          {t('mockPay.success')}
        </button>
        <button
          type="button"
          className="btn btn--danger"
          disabled={busy}
          onClick={() => run('fail')}
        >
          {t('mockPay.fail')}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={busy}
          onClick={() => navigate(`${to('checkout')}?cancelled=${order}`)}
        >
          {t('mockPay.cancel')}
        </button>
      </div>
    </main>
  );
}
