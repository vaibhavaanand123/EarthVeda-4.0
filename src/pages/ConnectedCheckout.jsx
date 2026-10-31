import { Lock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { COUNTRIES, isValidPostcode, toE164 } from '../../shared/markets.js';
import CartLines from '../components/CartLines';
import CartTotals from '../components/CartTotals';
import EmptyState from '../components/EmptyState';
import Field from '../components/Field';
import PaymentMarks from '../components/PaymentMarks';
import Seo from '../components/Seo';
import { useCart } from '../context/CartContext';
import { useStore } from '../context/StoreContext';
import { Interpolate, L, useI18n } from '../i18n/LanguageContext';
import { CHECKOUT_ATTEMPT_KEY as ATTEMPT_KEY, PENDING_ORDER_KEY } from '../lib/sessionKeys';
import { readSession, writeSession } from '../lib/storage';
import { uuid } from '../lib/uuid';
import { analyticsService } from '../services/analyticsService';
import { shopApi } from '../services/shopApi';
import StoreStatus from './StoreStatus';

const DRAFT_KEY = 'earthveda-checkout-draft';

const EMPTY = {
  email: '',
  firstName: '',
  lastName: '',
  company: '',
  phone: '',
  street: '',
  address2: '',
  postalCode: '',
  city: '',
};

function loadDraft() {
  try {
    return { ...EMPTY, ...JSON.parse(readSession(DRAFT_KEY) || '{}') };
  } catch {
    return EMPTY;
  }
}

/** Reuse the idempotency key while the payload is unchanged (safe retries). */
function idempotencyKeyFor(body) {
  const signature = JSON.stringify(body);
  try {
    const saved = JSON.parse(readSession(ATTEMPT_KEY) || 'null');
    if (saved?.signature === signature) return saved.key;
  } catch {
    /* ignore */
  }
  const key = uuid();
  writeSession(ATTEMPT_KEY, JSON.stringify({ key, signature }));
  return key;
}

export default function Checkout() {
  const { t, lang, to, money } = useI18n();
  const navigate = useNavigate();
  const store = useStore();
  const cart = useCart();
  const [params] = useSearchParams();
  const [form, setForm] = useState(loadDraft);
  const [note, setNote] = useState('');
  const [consents, setConsents] = useState({ terms: false, whatsapp: false, newsletter: false });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const errorRef = useRef(null);
  const country = cart.country;

  useEffect(() => {
    writeSession(DRAFT_KEY, JSON.stringify(form));
  }, [form]);
  useEffect(() => {
    analyticsService.track('begin_checkout', { value: cart.total / 100, currency: 'EUR' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (store.loading || store.error) return <StoreStatus />;
  if (cart.lines.length === 0)
    return (
      <main className="page container">
        <Seo title={t('checkout.title')} noindex />
        <EmptyState title={t('checkout.empty')} action={t('nav.box')} to="box" />
      </main>
    );

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors(({ [key]: _drop, ...rest }) => rest);
  };

  const validate = () => {
    const next = {};
    const required = ['email', 'firstName', 'lastName', 'phone', 'street', 'postalCode', 'city'];
    for (const key of required) if (!form[key].trim()) next[key] = t('checkout.fixErrors');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = t('checkout.fixErrors');
    if (form.postalCode && !isValidPostcode(form.postalCode, country))
      next.postalCode = COUNTRIES[country].postal.hint[lang];
    if (form.phone && !toE164(form.phone, country)) next.phone = t('checkout.phoneHint');
    if (!consents.terms) next.terms = t('checkout.termsRequired');
    return next;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (status.state === 'sending') return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      setStatus({ state: 'error', message: t('checkout.fixErrors') });
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    const body = {
      lang,
      country,
      ...cart.payload,
      expectedTotal: cart.total,
      customer: Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])),
      note: note.trim(),
      whatsappOptIn: consents.whatsapp,
      newsletterOptIn: consents.newsletter,
      acceptTerms: true,
      website: event.target.website.value,
    };
    setStatus({ state: 'sending', message: '' });
    try {
      let result;
      try {
        result = await shopApi.checkout(body, idempotencyKeyFor(body));
      } catch (error) {
        // The previous attempt with these details expired: start a fresh checkout once.
        if (error.code !== 'checkout_closed' && error.code !== 'idempotency_mismatch') throw error;
        writeSession(ATTEMPT_KEY, null);
        result = await shopApi.checkout(body, idempotencyKeyFor(body));
      }
      if (
        !result.paymentUrl &&
        ['paid', 'processing', 'shipped', 'delivered'].includes(result.status)
      ) {
        // This exact order was already paid (e.g. browser back after paying).
        cart.clear();
        writeSession(ATTEMPT_KEY, null);
        navigate(`${to('track')}?order=${result.orderNumber}`);
        return;
      }
      if (!result.paymentUrl) {
        // Earlier attempt ended without payment (failed, expired, cancelled): retry with a new key.
        writeSession(ATTEMPT_KEY, null);
        result = await shopApi.checkout(body, idempotencyKeyFor(body));
      }
      writeSession(PENDING_ORDER_KEY, result.orderNumber);
      if (result.paymentUrl) window.location.assign(result.paymentUrl);
      else setStatus({ state: 'error', message: t('common.errorGeneric') });
    } catch (error) {
      if (error.code === 'price_changed') {
        writeSession(ATTEMPT_KEY, null);
        store.retry();
      }
      const fieldErrors = {};
      for (const f of error.fields || [])
        fieldErrors[f.path.replace(/^customer\./, '')] = f.message;
      setErrors(fieldErrors);
      const message =
        error.code === 'network' || error.code === 'timeout'
          ? t('common.offline')
          : error.message || t('common.errorGeneric');
      setStatus({ state: 'error', message });
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  };

  const consent = (key) => (e) => {
    setConsents((c) => ({ ...c, [key]: e.target.checked }));
    if (key === 'terms') setErrors(({ terms: _t, ...rest }) => rest);
  };
  const cancelled = params.get('cancelled');

  return (
    <main className="page container">
      <Seo title={t('checkout.title')} noindex />
      <h1>{t('checkout.title')}</h1>
      {cancelled && <p className="notice">{t('checkout.cancelled')}</p>}

      <form className="checkout" onSubmit={submit} noValidate>
        <div className="checkout__form">
          {status.state === 'error' && (
            <p className="alert" role="alert" tabIndex={-1} ref={errorRef}>
              {status.message}
            </p>
          )}
          <fieldset>
            <legend>{t('checkout.contact')}</legend>
            <Field
              label={t('checkout.email')}
              type="email"
              autoComplete="email"
              inputMode="email"
              value={form.email}
              onChange={set('email')}
              hint={t('checkout.emailHint')}
              error={errors.email}
            />
          </fieldset>

          <fieldset>
            <legend>{t('checkout.delivery')}</legend>
            <div className="field">
              <label htmlFor="co-country">{t('checkout.country')}</label>
              <select
                id="co-country"
                autoComplete="country"
                value={country}
                onChange={(e) => cart.setCountry(e.target.value)}
              >
                {Object.values(COUNTRIES).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name[lang]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid-2">
              <Field
                label={t('checkout.firstName')}
                autoComplete="given-name"
                value={form.firstName}
                onChange={set('firstName')}
                error={errors.firstName}
              />
              <Field
                label={t('checkout.lastName')}
                autoComplete="family-name"
                value={form.lastName}
                onChange={set('lastName')}
                error={errors.lastName}
              />
            </div>
            <Field
              label={t('checkout.company')}
              optional
              autoComplete="organization"
              value={form.company}
              onChange={set('company')}
              error={errors.company}
            />
            <Field
              label={t('checkout.street')}
              autoComplete="address-line1"
              value={form.street}
              onChange={set('street')}
              error={errors.street}
            />
            <Field
              label={t('checkout.address2')}
              optional
              autoComplete="address-line2"
              value={form.address2}
              onChange={set('address2')}
              error={errors.address2}
            />
            <div className="grid-2 grid-2--postal">
              <Field
                label={country === 'GB' ? t('checkout.postalCodeGB') : t('checkout.postalCode')}
                autoComplete="postal-code"
                inputMode={country === 'DE' ? 'numeric' : 'text'}
                placeholder={COUNTRIES[country].postal.example}
                value={form.postalCode}
                onChange={set('postalCode')}
                error={errors.postalCode}
              />
              <Field
                label={t('checkout.city')}
                autoComplete="address-level2"
                value={form.city}
                onChange={set('city')}
                error={errors.city}
              />
            </div>
            <Field
              label={t('checkout.phone')}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={form.phone}
              onChange={set('phone')}
              hint={t('checkout.phoneHint')}
              error={errors.phone}
            />
            {country === 'GB' && <p className="notice notice--soft">{t('checkout.ukNote')}</p>}
            <Field
              label={t('checkout.note')}
              optional
              as="textarea"
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              className="hp"
              aria-hidden="true"
            />
          </fieldset>

          <fieldset className="consents">
            <label className="check">
              <input type="checkbox" checked={consents.whatsapp} onChange={consent('whatsapp')} />
              <span>{t('checkout.whatsapp')}</span>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={consents.newsletter}
                onChange={consent('newsletter')}
              />
              <span>{t('checkout.newsletter')}</span>
            </label>
          </fieldset>
        </div>

        <aside className="checkout__summary summary" aria-labelledby="summary-title">
          <h2 id="summary-title">{t('checkout.summary')}</h2>
          <CartLines compact />
          <CartTotals />
          <label className={`check check--terms${errors.terms ? ' is-error' : ''}`}>
            <input
              type="checkbox"
              checked={consents.terms}
              onChange={consent('terms')}
              aria-invalid={errors.terms ? 'true' : undefined}
              aria-describedby={errors.terms ? 'terms-err' : undefined}
            />
            <span>
              <Interpolate
                text={t('checkout.terms')}
                values={{
                  terms: (
                    <L to="terms" target="_blank">
                      {t('checkout.termsLink')}
                    </L>
                  ),
                  withdrawal: (
                    <L to="withdrawal" target="_blank">
                      {t('checkout.withdrawalLink')}
                    </L>
                  ),
                  privacy: (
                    <L to="privacy" target="_blank">
                      {t('checkout.privacyLink')}
                    </L>
                  ),
                }}
              />
            </span>
          </label>
          {errors.terms && (
            <p className="field__error" id="terms-err">
              {errors.terms}
            </p>
          )}
          <button
            className="btn btn--ink btn--block btn--lg"
            type="submit"
            disabled={status.state === 'sending' || !cart.canCheckout}
          >
            <Lock size={18} aria-hidden="true" />{' '}
            {status.state === 'sending'
              ? t('checkout.paying')
              : `${t('checkout.pay')} · ${money(cart.total)}`}
          </button>
          <p className="summary__note">{t('checkout.payNote')}</p>
          <PaymentMarks />
          <p className="summary__secure">{t('checkout.secure')}</p>
        </aside>
      </form>
    </main>
  );
}
