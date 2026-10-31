import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatDateTime } from '../../shared/markets.js';
import Field from '../components/Field';
import OrderSummary from '../components/OrderSummary';
import Seo from '../components/Seo';
import { useI18n } from '../i18n/LanguageContext';
import { shopApi } from '../services/shopApi';

const STEPS = ['paid', 'processing', 'shipped', 'delivered'];

export default function Track() {
  const { t, lang } = useI18n();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ orderNumber: params.get('order') || '', email: '' });
  const [state, setState] = useState({ status: 'idle', order: null, error: '' });

  const submit = async (event) => {
    event.preventDefault();
    setState({ status: 'loading', order: null, error: '' });
    try {
      const { order } = await shopApi.lookup({
        orderNumber: form.orderNumber.trim(),
        email: form.email.trim(),
      });
      setState({ status: 'done', order, error: '' });
    } catch (error) {
      setState({
        status: 'idle',
        order: null,
        error:
          error.status === 404 || error.status === 400 ? error.message : t('common.errorGeneric'),
      });
    }
  };

  const order = state.order;
  const reached = order ? STEPS.indexOf(order.status) : -1;
  return (
    <main className="page container narrow">
      <Seo title={t('track.title')} noindex />
      <h1>{t('track.title')}</h1>
      {!order ? (
        <form className="track-form" onSubmit={submit} noValidate>
          <p>{t('track.lede')}</p>
          {state.error && (
            <p className="alert" role="alert">
              {state.error}
            </p>
          )}
          <Field
            label={t('track.orderNumber')}
            hint={t('track.orderHint')}
            autoCapitalize="characters"
            value={form.orderNumber}
            onChange={(e) => setForm((f) => ({ ...f, orderNumber: e.target.value }))}
          />
          <Field
            label={t('track.email')}
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <button className="btn btn--ink" type="submit" disabled={state.status === 'loading'}>
            {t('track.submit')}
          </button>
        </form>
      ) : (
        <section aria-live="polite">
          <p className="confirm__number">
            {t('success.orderNumber')} <strong>{order.orderNumber}</strong> ·{' '}
            {t('track.placed', { date: formatDateTime(order.createdAt, lang) })}
          </p>
          <p>
            {t('track.status')}: <strong className="status-pill">{order.statusLabel}</strong>
          </p>
          {reached >= 0 && (
            <ol className="steps">
              {STEPS.map((s, i) => (
                <li key={s} className={i <= reached ? 'is-done' : ''}>
                  {order.timeline.find((e) => e.status === s)?.label ?? t(`track.step_${s}`)}
                </li>
              ))}
            </ol>
          )}
          {order.tracking && (
            <p>
              {order.tracking.number && (
                <>
                  {t('track.trackingNumber')}:{' '}
                  <strong>
                    {[order.tracking.carrier, order.tracking.number].filter(Boolean).join(' ')}
                  </strong>{' '}
                </>
              )}
              {order.tracking.url && (
                <a
                  className="link"
                  href={order.tracking.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('track.trackingLink')} <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
            </p>
          )}
          <OrderSummary order={order} />
          <button
            type="button"
            className="link"
            onClick={() => setState({ status: 'idle', order: null, error: '' })}
          >
            {t('track.another')}
          </button>
        </section>
      )}
    </main>
  );
}
