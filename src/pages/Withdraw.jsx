import { CheckCircle2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { formatDateTime } from '../../shared/markets.js';
import Field from '../components/Field';
import Seo from '../components/Seo';
import { L, useI18n } from '../i18n/LanguageContext';
import { shopApi } from '../services/shopApi';

/**
 * Online withdrawal function (§ 356a BGB): step 1 enter details, step 2
 * "Confirm withdrawal". No login and no reason required.
 */
export default function Withdraw() {
  const { t, lang } = useI18n();
  const [step, setStep] = useState('form');
  const [form, setForm] = useState({ name: '', orderNumber: '', email: '', scope: '' });
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const heading = useRef(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const review = (event) => {
    event.preventDefault();
    const next = {};
    if (form.name.trim().length < 2) next.name = t('checkout.fixErrors');
    if (form.orderNumber.trim().length < 3) next.orderNumber = t('checkout.fixErrors');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = t('checkout.fixErrors');
    setErrors(next);
    if (!Object.keys(next).length) {
      setStep('review');
      requestAnimationFrame(() => heading.current?.focus());
    }
  };

  const confirm = async () => {
    setSending(true);
    setError('');
    try {
      const res = await shopApi.withdraw({
        name: form.name.trim(),
        orderNumber: form.orderNumber.trim(),
        email: form.email.trim(),
        scope: form.scope.trim(),
        lang,
        website: '',
      });
      setResult(res);
      setStep('done');
    } catch (e) {
      setError(e.message || t('common.errorGeneric'));
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="page container narrow withdraw">
      <Seo title={t('withdraw.title')} description={t('withdraw.lede')} />
      <h1>{t('withdraw.title')}</h1>
      {step === 'form' && (
        <form onSubmit={review} noValidate>
          <p>{t('withdraw.lede')}</p>
          <Field
            label={t('withdraw.name')}
            autoComplete="name"
            value={form.name}
            onChange={set('name')}
            error={errors.name}
          />
          <Field
            label={t('withdraw.orderNumber')}
            hint={t('withdraw.orderHint')}
            value={form.orderNumber}
            onChange={set('orderNumber')}
            error={errors.orderNumber}
          />
          <Field
            label={t('withdraw.email')}
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
            error={errors.email}
          />
          <Field
            label={t('withdraw.scope')}
            hint={t('withdraw.scopeHint')}
            optional
            as="textarea"
            rows={3}
            maxLength={500}
            value={form.scope}
            onChange={set('scope')}
          />
          <button className="btn btn--ink btn--lg" type="submit">
            {t('withdraw.review')}
          </button>
          <p>
            <L className="link" to="withdrawal">
              {t('withdraw.policy')}
            </L>
          </p>
        </form>
      )}
      {step === 'review' && (
        <section aria-labelledby="wd-review">
          <h2 id="wd-review" tabIndex={-1} ref={heading}>
            {t('withdraw.reviewTitle')}
          </h2>
          <p>{t('withdraw.declaration')}</p>
          <dl className="review">
            <dt>{t('withdraw.name')}</dt>
            <dd>{form.name}</dd>
            <dt>{t('withdraw.orderNumber')}</dt>
            <dd>{form.orderNumber}</dd>
            <dt>{t('withdraw.email')}</dt>
            <dd>{form.email}</dd>
            <dt>{t('withdraw.scope')}</dt>
            <dd>{form.scope || t('withdraw.whole')}</dd>
          </dl>
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          <div className="confirm__actions">
            <button
              type="button"
              className="btn btn--ink btn--lg"
              onClick={confirm}
              disabled={sending}
            >
              {t('withdraw.confirm')}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setStep('form')}
              disabled={sending}
            >
              {t('withdraw.edit')}
            </button>
          </div>
        </section>
      )}
      {step === 'done' && result && (
        <section className="confirm" role="status">
          <div className="confirm__icon" aria-hidden="true">
            <CheckCircle2 size={56} />
          </div>
          <h2>{t('withdraw.doneTitle')}</h2>
          <p>
            {t('withdraw.doneLede', {
              date: formatDateTime(result.receivedAt, lang),
              email: form.email,
              reference: result.reference,
            })}
          </p>
        </section>
      )}
    </main>
  );
}
