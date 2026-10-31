import { COUNTRIES } from '../../shared/markets.js';
import { useCart } from '../context/CartContext';
import { useI18n } from '../i18n/LanguageContext';

export default function CartTotals({ showVat = true }) {
  const { t, money, lang } = useI18n();
  const cart = useCart();
  return (
    <dl className="totals">
      <div>
        <dt>{t('cart.subtotal')}</dt>
        <dd>{money(cart.subtotal)}</dd>
      </div>
      <div>
        <dt>{t('cart.shippingTo', { country: COUNTRIES[cart.country].name[lang] })}</dt>
        <dd>{money(cart.shipping)}</dd>
      </div>
      <div className="totals__grand">
        <dt>{t('cart.total')}</dt>
        <dd>{money(cart.total)}</dd>
      </div>
      {showVat &&
        cart.vat.map((v) => (
          <div key={v.rate} className="totals__vat">
            <dt className="sr-only">VAT</dt>
            <dd>{t('cart.vatIncl', { amount: money(v.amount), rate: v.rate })}</dd>
          </div>
        ))}
    </dl>
  );
}
