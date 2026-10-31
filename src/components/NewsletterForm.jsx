import { ArrowRight, Check } from 'lucide-react';
import { useId, useState } from 'react';
import { config } from '../config';
import { Interpolate, L, useI18n } from '../i18n/LanguageContext';
import { validNewsletter } from '../lib/previewCheckout.js';
import { shopApi } from '../services/shopApi';

export default function NewsletterForm({ source = 'footer', variant = 'band' }) {
  const { t, lang } = useI18n();
  const id = useId();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState({ status: 'idle', error: '' });
  const submit = async (event) => {
    event.preventDefault();
    if (state.status === 'sending') return;
    if (!validNewsletter(email, consent)) {
      setState({ status: 'idle', error: t('refresh.newsletter.invalid') });
      return;
    }
    if (config.preview) {
      setEmail('');
      setState({ status: 'preview', error: '' });
      return;
    }
    setState({ status: 'sending', error: '' });
    try {
      await shopApi.subscribe({
        email: email.trim(),
        lang,
        source,
        website: event.target.website.value,
      });
      setEmail('');
      setState({ status: 'done', error: '' });
    } catch (error) {
      setState({
        status: 'idle',
        error: error.code === 'validation_failed' ? error.message : t('common.errorGeneric'),
      });
    }
  };
  return (
    <section className={`newsletter newsletter--${variant}`} aria-labelledby={`${id}-title`}>
      <div className="newsletter__copy">
        <p className="eyebrow">{t('refresh.newsletter.eyebrow')}</p>
        <h2 id={`${id}-title`}>{t('refresh.newsletter.title')}</h2>
        <p>{t('refresh.newsletter.body')}</p>
      </div>
      {state.status === 'done' ? (
        <p className="newsletter__done" role="status">
          <Check aria-hidden="true" />
          {t('newsletter.thanks')}
        </p>
      ) : state.status === 'preview' ? (
        <div className="newsletter__preview" role="status">
          <p>{t('refresh.newsletter.preview')}</p>
          <button
            type="button"
            className="link"
            onClick={() => {
              setState({ status: 'idle', error: '' });
              setConsent(false);
            }}
          >
            {lang === 'de' ? 'Noch einmal ansehen' : 'Try the form again'}
          </button>
        </div>
      ) : (
        <form className="newsletter__form" onSubmit={submit} noValidate>
          <div className="newsletter__row">
            <label className="sr-only" htmlFor={id}>
              {t('newsletter.label')}
            </label>
            <input
              id={id}
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('newsletter.placeholder')}
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? `${id}-error` : `${id}-consent`}
            />
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              className="hp"
              aria-hidden="true"
            />
            <button type="submit" className="btn btn--chana" disabled={state.status === 'sending'}>
              {state.status === 'sending' ? t('common.loading') : t('refresh.newsletter.submit')}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>{t('refresh.newsletter.consent')}</span>
          </label>
          {state.error && (
            <p className="field__error" id={`${id}-error`} role="alert">
              {state.error}
            </p>
          )}
          <p className="newsletter__consent" id={`${id}-consent`}>
            <Interpolate
              text={t('newsletter.consent')}
              values={{ privacy: <L to="privacy">{t('newsletter.privacyLink')}</L> }}
            />
          </p>
        </form>
      )}
    </section>
  );
}
