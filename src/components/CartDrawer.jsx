import { ArrowRight, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useCloseOnNavigate } from '../hooks/useCloseOnNavigate';
import { useDialog } from '../hooks/useDialog';
import { L, useI18n } from '../i18n/LanguageContext';
import CartLines from './CartLines';
import CartTotals from './CartTotals';
import CountrySelect from './CountrySelect';

export default function CartDrawer() {
  const { t } = useI18n();
  const cart = useCart();
  const ref = useDialog(cart.drawerOpen, cart.closeDrawer);
  useCloseOnNavigate(cart.closeDrawer);
  if (!cart.drawerOpen) return null;
  const offerBox =
    !cart.lines.some((l) => l.kind === 'box') &&
    cart.lines.some((l) => l.product?.range === 'foxnuts');
  return (
    <div className="overlay" onClick={cart.closeDrawer} role="presentation">
      <aside
        ref={ref}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="drawer__head">
          <h2 id="drawer-title">
            {t('cart.title')} <span>({cart.count})</span>
          </h2>
          <button
            type="button"
            className="icon-btn"
            onClick={cart.closeDrawer}
            aria-label={t('common.close')}
            data-autofocus
          >
            <X aria-hidden="true" />
          </button>
        </header>
        {cart.lines.length === 0 ? (
          <div className="drawer__empty">
            <p>{t('cart.empty')}</p>
            <L className="btn btn--ink" to="box">
              {t('nav.box')}
            </L>
            <L className="link" to="shop" query={{ range: 'foxnuts' }}>
              {t('cart.emptyCta')}
            </L>
          </div>
        ) : (
          <>
            <div className="drawer__lines">
              <CartLines compact />
              {offerBox && (
                <p className="drawer__tip">
                  <L to="box">{t('cart.upsellBox')}</L>
                </p>
              )}
            </div>
            <footer className="drawer__foot">
              <CountrySelect compact />
              <CartTotals showVat={false} />
              <p className="drawer__note">{t('common.vatNote')}</p>
              {cart.canCheckout ? (
                <L className="btn btn--ink btn--block btn--lg" to="checkout">
                  {t('cart.checkout')} <ArrowRight size={18} aria-hidden="true" />
                </L>
              ) : (
                <button type="button" className="btn btn--ink btn--block btn--lg" disabled>
                  {t('cart.checkout')}
                </button>
              )}
              <L className="link" to="cart">
                {t('cart.viewBag')}
              </L>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
