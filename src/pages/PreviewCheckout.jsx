import { ArrowLeft, ArrowRight, Check, Info, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { COUNTRIES } from '../../shared/markets.js';
import CartLines from '../components/CartLines';
import CartTotals from '../components/CartTotals';
import EmptyState from '../components/EmptyState';
import Field from '../components/Field';
import Seo from '../components/Seo';
import { useCart } from '../context/CartContext';
import { L, useI18n } from '../i18n/LanguageContext';
import { exampleAddress, PREVIEW_METHODS, validPreviewAddress } from '../lib/previewCheckout.js';

const EMPTY = { email: '', firstName: '', lastName: '', street: '', postalCode: '', city: '' };

export default function PreviewCheckout() {
  const { t, lang, money } = useI18n();
  const cart = useCart();
  // PII deliberately remains in component memory. No storage, network or order IDs.
  const [form, setForm] = useState(EMPTY);
  const [method, setMethod] = useState('Mastercard');
  const [accepted, setAccepted] = useState(false);
  const [step, setStep] = useState('details');
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const statusRef = useRef(null);
  const headingRef = useRef(null);

  const change = (key) => (event) => {
    setForm((value) => ({ ...value, [key]: event.target.value }));
    setError('');
    setStep('details');
  };
  const submit = (event) => {
    event.preventDefault();
    if (
      !cart.canCheckout ||
      !validPreviewAddress(form, cart.country) ||
      !accepted ||
      !PREVIEW_METHODS.includes(method)
    ) {
      setError(t('refresh.preview.validation'));
      requestAnimationFrame(() => statusRef.current?.focus());
      return;
    }
    if (step === 'details') {
      setStep('review');
      setError('');
      requestAnimationFrame(() => headingRef.current?.focus());
    } else {
      setSnapshot({ count: cart.count, total: cart.total, country: cart.country, method });
      setForm(EMPTY);
      setAccepted(false);
      setStep('done');
      // Keep the bag available so the founder can repeat the walkthrough.
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  if (step === 'done')
    return (
      <main className="demo-complete container">
        <Seo title={t('refresh.preview.complete')} noindex />
        <span className="demo-complete__icon">
          <Check size={34} aria-hidden="true" />
        </span>
        <p className="eyebrow">{lang === 'de' ? 'DEMO ABGESCHLOSSEN' : 'DEMO CHECKOUT COMPLETE'}</p>
        <h1>{t('refresh.preview.complete')}</h1>
        <p>{t('refresh.preview.completeNote')}</p>
        <p>
          <strong>
            {snapshot.count} {lang === 'de' ? 'Packungen' : 'packs'} · {money(snapshot.total)} ·{' '}
            {COUNTRIES[snapshot.country].name[lang]}
          </strong>
        </p>
        <L to="shop" className="btn btn--ink btn--lg">
          {t('refresh.preview.back')}
          <ArrowRight size={17} aria-hidden="true" />
        </L>
      </main>
    );

  if (!cart.lines.length)
    return (
      <main className="page container">
        <Seo title={t('checkout.title')} noindex />
        <EmptyState title={t('checkout.empty')} action={t('refresh.preview.back')} to="shop" />
      </main>
    );

  return (
    <main className="page container">
      <Seo title={t('refresh.preview.title')} noindex />
      <L to="cart" className="link link--arrow">
        <ArrowLeft size={15} aria-hidden="true" />
        {t('cart.title')}
      </L>
      <h1 className="demo-heading">{t('refresh.preview.title')}</h1>
      <div className="demo-intro">
        <Info size={22} aria-hidden="true" />
        <p>{t('refresh.preview.intro')}</p>
      </div>
      <button
        type="button"
        className="demo-example"
        onClick={() => {
          setForm(exampleAddress(cart.country));
          setStep('details');
          setError('');
        }}
      >
        <Sparkles size={15} aria-hidden="true" />
        {t('refresh.preview.example')}
      </button>
      <form className="demo-checkout" onSubmit={submit} noValidate>
        <div>
          {error && (
            <p className="alert" role="alert" tabIndex={-1} ref={statusRef}>
              {error}
            </p>
          )}
          <fieldset className="demo-form-section">
            <legend>{t('refresh.preview.delivery')}</legend>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="preview-country">{t('checkout.country')}</label>
                <select
                  id="preview-country"
                  value={cart.country}
                  onChange={(event) => {
                    cart.setCountry(event.target.value);
                    setStep('details');
                    setError('');
                  }}
                  autoComplete="country"
                >
                  {Object.values(COUNTRIES).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name[lang]}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                label={t('checkout.email')}
                type="email"
                value={form.email}
                onChange={change('email')}
                autoComplete="email"
                maxLength={200}
                required
              />
            </div>
            <div className="grid-2">
              <Field
                label={t('checkout.firstName')}
                value={form.firstName}
                onChange={change('firstName')}
                autoComplete="given-name"
                maxLength={100}
                required
              />
              <Field
                label={t('checkout.lastName')}
                value={form.lastName}
                onChange={change('lastName')}
                autoComplete="family-name"
                maxLength={100}
                required
              />
            </div>
            <Field
              label={t('checkout.street')}
              value={form.street}
              onChange={change('street')}
              autoComplete="street-address"
              maxLength={200}
              required
            />
            <div className="grid-2">
              <Field
                label={t('checkout.postalCode')}
                value={form.postalCode}
                onChange={change('postalCode')}
                autoComplete="postal-code"
                placeholder={COUNTRIES[cart.country].postal.example}
                maxLength={12}
                required
              />
              <Field
                label={t('checkout.city')}
                value={form.city}
                onChange={change('city')}
                autoComplete="address-level2"
                maxLength={100}
                required
              />
            </div>
          </fieldset>
          <fieldset className="demo-form-section">
            <legend>{t('refresh.preview.payment')}</legend>
            <div className="demo-payment-grid">
              {PREVIEW_METHODS.map((name) => (
                <label key={name} className={name === method ? 'is-on' : ''}>
                  <input
                    type="radio"
                    name="preview-payment"
                    value={name}
                    checked={name === method}
                    onChange={() => {
                      setMethod(name);
                      setStep('details');
                    }}
                  />
                  <span>{name === 'American Express' ? 'Amex' : name}</span>
                </label>
              ))}
            </div>
            <p className="demo-method-note">{t('refresh.preview.methodNote')}</p>
          </fieldset>
        </div>
        <aside className="demo-summary" aria-labelledby="preview-summary">
          <h2 id="preview-summary">{t('refresh.preview.summary')}</h2>
          <CartLines compact />
          <CartTotals />
          <label className="check">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            <span>{t('refresh.preview.check')}</span>
          </label>
          {step === 'review' && (
            <div className="demo-review">
              <h3 ref={headingRef} tabIndex={-1}>
                {t('refresh.preview.review')}
              </h3>
              <p>
                {form.firstName} {form.lastName}
                <br />
                {form.street}
                <br />
                {form.postalCode} {form.city}
                <br />
                {form.email}
              </p>
              <p>
                {method} · {money(cart.total)}
              </p>
            </div>
          )}
          <button
            className="btn btn--ink btn--lg btn--block"
            type="submit"
            disabled={!cart.canCheckout}
          >
            {step === 'review' ? t('refresh.preview.confirm') : t('refresh.preview.review')}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
          <p className="demo-method-note">{t('refresh.preview.intro')}</p>
        </aside>
      </form>
    </main>
  );
}
