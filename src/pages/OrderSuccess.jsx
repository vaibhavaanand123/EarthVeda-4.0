import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import OrderSummary from '../components/OrderSummary';
import Seo from '../components/Seo';
import { useCart } from '../context/CartContext';
import { L, useI18n } from '../i18n/LanguageContext';
import { CHECKOUT_ATTEMPT_KEY, PENDING_ORDER_KEY } from '../lib/sessionKeys';
import { readSession, writeSession } from '../lib/storage';
import { analyticsService } from '../services/analyticsService';
import { shopApi } from '../services/shopApi';

const PAID = ['paid', 'processing', 'shipped', 'delivered'];

/** Landing page after the payment provider redirects back. Polls until paid. */
export default function OrderSuccess() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const orderNumber = params.get('order') || '';
  const sessionId = params.get('session_id') || '';
  const cart = useCart();
  const [state, setState] = useState({ order: null, error: false });
  const cleared = useRef(false);

  useEffect(() => {
    if (!orderNumber || !sessionId) {
      return undefined;
    }
    let cancelled = false;
    let attempts = 0;
    let timer;
    const poll = async () => {
      try {
        const { order } = await shopApi.orderStatus(orderNumber, sessionId);
        if (cancelled) return;
        setState({ order, error: false });
        if (order.status === 'pending_payment' && attempts < 15) {
          attempts += 1;
          timer = setTimeout(poll, 2000);
        }
      } catch {
        if (!cancelled) setState({ order: null, error: true });
      }
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderNumber, sessionId]);

  const order = state.order;
  const paid = order && PAID.includes(order.status);
  useEffect(() => {
    if (!paid || cleared.current) return;
    cleared.current = true;
    if (readSession(PENDING_ORDER_KEY) === order.orderNumber) {
      cart.clear();
      writeSession(PENDING_ORDER_KEY, null);
      writeSession(CHECKOUT_ATTEMPT_KEY, null);
      analyticsService.track('purchase', {
        transaction_id: order.orderNumber,
        value: (order.amountPaid ?? order.total) / 100,
        currency: 'EUR',
      });
    }
  }, [paid, order, cart]);

  const failed = order && ['payment_failed', 'expired'].includes(order.status);
  return (
    <main className="page container narrow confirm">
      <Seo title={t('success.title')} noindex />
      {state.error || !orderNumber || !sessionId ? (
        <>
          <h1>{t('success.notFound')}</h1>
          <L className="btn btn--ink" to="track">
            {t('success.track')}
          </L>
        </>
      ) : !order ? (
        <p aria-busy="true">{t('success.checking')}</p>
      ) : (
        <>
          <div className={`confirm__icon${failed ? ' is-failed' : ''}`} aria-hidden="true">
            {paid ? (
              <CheckCircle2 size={56} />
            ) : failed ? (
              <XCircle size={56} />
            ) : (
              <Clock size={56} />
            )}
          </div>
          <h1>{failed ? t('success.failedLede') : t('success.title')}</h1>
          {!failed && (
            <p className="confirm__lede">
              {paid ? t('success.paidLede') : t('success.pendingLede')}
            </p>
          )}
          <p className="confirm__number">
            {t('success.orderNumber')} <strong>{order.orderNumber}</strong>
          </p>
          <OrderSummary order={order} />
          <div className="confirm__actions">
            {failed ? (
              <L className="btn btn--ink" to="checkout">
                {t('success.tryAgain')}
              </L>
            ) : (
              <L className="btn btn--ink" to="track" query={{ order: order.orderNumber }}>
                {t('success.track')}
              </L>
            )}
            <L className="btn btn--ghost" to="shop">
              {t('success.keepShopping')}
            </L>
          </div>
        </>
      )}
    </main>
  );
}
