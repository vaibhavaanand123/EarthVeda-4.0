import { PAYMENT_METHOD_NAMES } from '../../shared/payments.js';
import { useI18n } from '../i18n/LanguageContext';
import { PREVIEW_METHODS } from '../lib/previewCheckout.js';
import { config } from '../config';

/**
 * Accepted payment methods as neutral text badges. Swap in the official
 * acceptance marks from each provider's brand kit if you prefer logos.
 */
export default function PaymentMarks({ tone = 'light' }) {
  const { t } = useI18n();
  return (
    <ul
      className={`paymarks paymarks--${tone}`}
      aria-label={config.preview ? t('refresh.footer.planned') : t('payments.label')}
    >
      {(config.preview ? PREVIEW_METHODS : PAYMENT_METHOD_NAMES).map((name) => (
        <li key={name} className={`paymark--${name.toLowerCase().replace(/\s+/g, '-')}`}>
          {name === 'American Express' ? 'Amex' : name}
        </li>
      ))}
    </ul>
  );
}
