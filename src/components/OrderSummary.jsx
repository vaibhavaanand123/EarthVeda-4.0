import { useI18n } from '../i18n/LanguageContext';

/** Read-only order lines and totals (success and tracking pages). */
export default function OrderSummary({ order }) {
  const { t, money } = useI18n();
  return (
    <div className="order-summary">
      <ul className="order-summary__lines">
        {order.lines.map((l, i) => (
          <li key={i}>
            <span>
              {l.quantity} × <strong>{l.name}</strong>
              {l.picks && (
                <small>{l.picks.map((p) => `${p.quantity}× ${p.name}`).join(', ')}</small>
              )}
            </span>
            <span>{money(l.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="totals">
        <div>
          <dt>{t('cart.subtotal')}</dt>
          <dd>{money(order.subtotal)}</dd>
        </div>
        <div>
          <dt>{t('cart.shipping')}</dt>
          <dd>{money(order.shipping)}</dd>
        </div>
        {order.discount > 0 && (
          <div>
            <dt>{t('cart.discount')}</dt>
            <dd>−{money(order.discount)}</dd>
          </div>
        )}
        <div className="totals__grand">
          <dt>{t('cart.total')}</dt>
          <dd>{money(order.amountPaid ?? order.total)}</dd>
        </div>
        {order.vat?.map((v) => (
          <div key={v.rate} className="totals__vat">
            <dt className="sr-only">VAT</dt>
            <dd>{t('cart.vatIncl', { amount: money(v.amount), rate: v.rate })}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
