import { unitPricePerKg } from '../../shared/pricing.js';
import { L, useI18n } from '../i18n/LanguageContext';

/**
 * Price with the German legal extras: price per kg (PAngV) once the net weight
 * is known, and the "incl. VAT, plus shipping" note where requested.
 */
export default function Price({
  product,
  quantity = 1,
  showUnit = false,
  showVat = false,
  className = '',
}) {
  const { t, money, lang } = useI18n();
  const perKg = showUnit ? unitPricePerKg(product.price, product.netWeightGrams) : null;
  return (
    <span className={`price ${className}`}>
      <strong>{money(product.price * quantity)}</strong>
      {product.range === 'protein' && (
        <small className="price__unit">
          {quantity > 1
            ? `${quantity} × ${money(product.price)}`
            : lang === 'de'
              ? 'pro Stück'
              : 'per unit'}
        </small>
      )}
      {perKg !== null && (
        <small className="price__unit">{t('common.perKg', { price: money(perKg) })}</small>
      )}
      {showVat && (
        <small className="price__vat">
          <L to="shipping">{t('common.vatNote')}</L>
        </small>
      )}
    </span>
  );
}
