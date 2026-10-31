import { ArrowRight } from 'lucide-react';
import CartLines from '../components/CartLines';
import CartTotals from '../components/CartTotals';
import CountrySelect from '../components/CountrySelect';
import EmptyState from '../components/EmptyState';
import PaymentMarks from '../components/PaymentMarks';
import Seo from '../components/Seo';
import { useCart } from '../context/CartContext';
import { useStore } from '../context/StoreContext';
import { L, useI18n } from '../i18n/LanguageContext';
import StoreStatus from './StoreStatus';

export default function Cart() {
  const { t } = useI18n();
  const store = useStore();
  const cart = useCart();
  if (store.loading || store.error) return <StoreStatus />;
  return (
    <main className="page container">
      <Seo title={t('cart.title')} noindex />
      <h1>{t('cart.title')}</h1>
      {cart.lines.length === 0 ? (
        <EmptyState title={t('cart.empty')} action={t('nav.box')} to="box" />
      ) : (
        <div className="cart-layout">
          <section aria-label={t('cart.title')}>
            <CartLines />
            <L className="link" to="shop">
              {t('cart.continueShopping')}
            </L>
          </section>
          <aside className="summary">
            <CountrySelect />
            <CartTotals />
            {cart.canCheckout ? (
              <L className="btn btn--ink btn--block btn--lg" to="checkout">
                {t('cart.checkout')} <ArrowRight size={18} aria-hidden="true" />
              </L>
            ) : (
              <button type="button" className="btn btn--ink btn--block btn--lg" disabled>
                {t('cart.checkout')}
              </button>
            )}
            <PaymentMarks />
          </aside>
        </div>
      )}
    </main>
  );
}
