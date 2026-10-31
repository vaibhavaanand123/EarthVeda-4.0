import { ArrowLeft, Mail, MessageCircle, Printer } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { COUNTRIES } from '../../../shared/markets.js';
import { MANUAL_TRANSITIONS, statusLabel } from '../../../shared/orderStatus.js';
import { adminApi } from '../adminApi';
import { useAdmin } from '../AdminContext';
import {
  ErrorNote,
  PageHead,
  StatusPill,
  euroInput,
  formatDate,
  formatEuro,
  parseEuro,
  useAction,
  useLoad,
} from '../ui';

const ACTION_LABELS = {
  processing: 'Start packing',
  shipped: 'Mark as shipped',
  delivered: 'Mark as delivered',
  cancelled: 'Cancel order',
};

const DHL_URL = (number, country) =>
  country === 'GB'
    ? `https://www.dhl.com/gb-en/home/tracking.html?tracking-id=${encodeURIComponent(number)}`
    : `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${encodeURIComponent(number)}`;

export default function OrderDetail() {
  const { orderNumber } = useParams();
  const { data, loading, error, setData } = useLoad(
    () => adminApi.order(orderNumber),
    [orderNumber],
  );
  const order = data?.order;
  if (loading && !order) return <p>Loading…</p>;
  if (error) return <ErrorNote message={error} />;
  if (!order) return null;
  return <OrderEditor key={order.orderNumber} order={order} setData={setData} />;
}

function OrderEditor({ order, setData }) {
  const { user } = useAdmin();
  const owner = user.role === 'owner';
  const action = useAction();
  const [tracking, setTracking] = useState(() => ({
    carrier: order.tracking.carrier || 'DHL',
    number: order.tracking.number || '',
    url: order.tracking.url || '',
  }));
  const [note, setNote] = useState(order.internalNote || '');
  const [refund, setRefund] = useState({ open: false, amount: '', reason: '', cancel: false });

  const apply = async (fn) => {
    const res = await action.run(fn);
    if (res?.order) setData({ order: res.order });
  };
  const next = (order.refundReserved > 0 ? [] : MANUAL_TRANSITIONS[order.status] || []).filter(
    (s) => s !== 'cancelled' || !(order.amountPaid > order.amountRefunded) || owner,
  );
  const c = order.customer;
  const refundable = Math.max(
    0,
    (order.amountPaid ?? 0) - order.amountRefunded - (order.refundReserved || 0),
  );
  const waLink = `https://wa.me/${c.phone.replace(/[^\d]/g, '')}`;

  const trackingUrl = () =>
    tracking.url ||
    (tracking.carrier.toUpperCase() === 'DHL' && tracking.number
      ? DHL_URL(tracking.number, order.country)
      : '');

  const changeStatus = (status) => {
    if (status === 'cancelled' && refundable > 0) {
      setRefund({ open: true, amount: euroInput(refundable), reason: '', cancel: true });
      return;
    }
    if (status === 'shipped') {
      const typed = tracking.number.trim();
      if (!typed && !window.confirm('No tracking number. Mark as shipped anyway?')) return;
      // Save a typed but unsaved tracking number first, so the shipping email includes it.
      if (typed && typed !== order.tracking.number)
        return apply(async () => {
          await adminApi.setTracking(order.orderNumber, { ...tracking, url: trackingUrl() });
          return adminApi.setStatus(order.orderNumber, { status, notifyCustomer: true });
        });
    }
    apply(() => adminApi.setStatus(order.orderNumber, { status, notifyCustomer: true }));
  };

  return (
    <div className="adm-order">
      <Link to="/admin/orders" className="adm-back">
        <ArrowLeft size={16} aria-hidden="true" /> Orders
      </Link>
      <PageHead title={order.orderNumber}>
        <StatusPill status={order.status} />
        <button type="button" className="adm-btn adm-btn--ghost" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" /> Packing slip
        </button>
      </PageHead>
      <ErrorNote message={action.error} />
      {order.refundReserved > 0 && (
        <p className="adm-warnbox">
          Refund of {formatEuro(order.refundReserved)} is pending. Do not pack or dispatch this
          order. Refresh after the worker processes it.
        </p>
      )}
      {order.status === 'review_required' && (
        <p className="adm-warnbox">
          Payment needs review. Do not fulfil this order. Check the matching merchant account and
          refund if appropriate.
        </p>
      )}
      <button
        className="adm-btn adm-btn--ghost"
        onClick={() => apply(() => adminApi.order(order.orderNumber))}
      >
        Refresh order
      </button>

      {next.length > 0 && (
        <div className="adm-actions">
          {next.map((s) => (
            <button
              key={s}
              type="button"
              className={`adm-btn${s === 'cancelled' ? ' adm-btn--danger' : ''}`}
              disabled={action.busy}
              onClick={() => changeStatus(s)}
            >
              {ACTION_LABELS[s] || statusLabel(s, 'en')}
            </button>
          ))}
          {owner && refundable > 0 && (
            <button
              type="button"
              className="adm-btn adm-btn--ghost"
              onClick={() =>
                setRefund({ open: true, amount: euroInput(refundable), reason: '', cancel: false })
              }
            >
              Refund
            </button>
          )}
        </div>
      )}
      {owner && next.length === 0 && refundable > 0 && (
        <div className="adm-actions">
          <button
            type="button"
            className="adm-btn adm-btn--ghost"
            onClick={() =>
              setRefund({ open: true, amount: euroInput(refundable), reason: '', cancel: false })
            }
          >
            Refund
          </button>
        </div>
      )}

      {refund.open && (
        <form
          className="adm-card adm-refund"
          onSubmit={(e) => {
            e.preventDefault();
            const amount = parseEuro(refund.amount);
            if (!Number.isFinite(amount) || amount <= 0)
              return action.setError('Enter a valid amount.');
            if (
              !window.confirm(
                `Request a refund of ${formatEuro(amount)}? Fulfilment pauses until the provider confirms it.`,
              )
            )
              return;
            apply(() =>
              adminApi.refund(order.orderNumber, {
                amount,
                reason: refund.reason,
                cancel: refund.cancel,
              }),
            ).then(() => setRefund((r) => ({ ...r, open: false })));
          }}
        >
          <h2>{refund.cancel ? 'Cancel and refund' : 'Refund'}</h2>
          <p className="muted">
            Refunds go back to the original payment method through Stripe. Up to{' '}
            {formatEuro(refundable)}.
          </p>
          <label>
            Amount (€)
            <input
              inputMode="decimal"
              value={refund.amount}
              onChange={(e) => setRefund((r) => ({ ...r, amount: e.target.value }))}
            />
          </label>
          <label>
            Reason (shown to the customer)
            <input
              value={refund.reason}
              maxLength={300}
              onChange={(e) => setRefund((r) => ({ ...r, reason: e.target.value }))}
            />
          </label>
          <div className="adm-actions">
            <button className="adm-btn adm-btn--danger" type="submit" disabled={action.busy}>
              Refund {refund.cancel ? 'and cancel' : ''}
            </button>
            <button
              type="button"
              className="adm-btn adm-btn--ghost"
              onClick={() => setRefund((r) => ({ ...r, open: false }))}
            >
              Close
            </button>
          </div>
        </form>
      )}

      <div className="adm-order__grid">
        <section className="adm-card print-area">
          <h2>Items to pack</h2>
          <ul className="adm-lines">
            {order.lines.map((l, i) => (
              <li key={i}>
                <div>
                  <strong>
                    {l.quantity} × {l.name}
                  </strong>
                  <small>{l.sku}</small>
                  {l.picks && (
                    <ul>
                      {l.picks.map((p) => (
                        <li key={p.sku}>
                          {p.quantity * l.quantity} × {p.name} <small>{p.sku}</small>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <span>{formatEuro(l.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="adm-totals">
            <dt>Subtotal</dt>
            <dd>{formatEuro(order.subtotal)}</dd>
            <dt>Shipping</dt>
            <dd>{formatEuro(order.shipping)}</dd>
            {order.discount > 0 && (
              <>
                <dt>Discount {order.payment.promoCode && `(${order.payment.promoCode})`}</dt>
                <dd>−{formatEuro(order.discount)}</dd>
              </>
            )}
            <dt>
              <strong>{order.amountPaid != null ? 'Paid' : 'Total'}</strong>
            </dt>
            <dd>
              <strong>{formatEuro(order.amountPaid ?? order.total)}</strong>
            </dd>
            {order.amountRefunded > 0 && (
              <>
                <dt>Refunded</dt>
                <dd>−{formatEuro(order.amountRefunded)}</dd>
              </>
            )}
            {order.vat.map((v) => (
              <Fragment key={v.rate}>
                <dt className="muted">incl. VAT {v.rate}%</dt>
                <dd className="muted">{formatEuro(v.amount)}</dd>
              </Fragment>
            ))}
          </dl>
          {order.note && (
            <p className="adm-note">
              <strong>Customer note:</strong> {order.note}
            </p>
          )}
        </section>

        <section className="adm-card print-area">
          <h2>Ship to</h2>
          <address>
            <strong>
              {c.firstName} {c.lastName}
            </strong>
            <br />
            {c.company && (
              <>
                {c.company}
                <br />
              </>
            )}
            {c.street}
            <br />
            {c.address2 && (
              <>
                {c.address2}
                <br />
              </>
            )}
            {c.postalCode} {c.city}
            <br />
            {COUNTRIES[c.country]?.name.en}
          </address>
          <p className="adm-contact no-print">
            <a href={`mailto:${c.email}`}>
              <Mail size={16} aria-hidden="true" /> {c.email}
            </a>
            <a href={waLink} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={16} aria-hidden="true" /> {c.phone}
            </a>
          </p>
          <p className="muted no-print">
            Language: {order.lang.toUpperCase()} · WhatsApp updates:{' '}
            {order.whatsappOptIn ? 'yes' : 'no'}
          </p>
        </section>

        <section className="adm-card no-print">
          <h2>Shipment</h2>
          <form
            className="adm-form"
            onSubmit={(e) => {
              e.preventDefault();
              const url = trackingUrl();
              apply(() => adminApi.setTracking(order.orderNumber, { ...tracking, url }));
            }}
          >
            <label>
              Carrier
              <input
                value={tracking.carrier}
                onChange={(e) => setTracking((t) => ({ ...t, carrier: e.target.value }))}
              />
            </label>
            <label>
              Tracking number
              <input
                value={tracking.number}
                onChange={(e) => setTracking((t) => ({ ...t, number: e.target.value.trim() }))}
              />
            </label>
            <label>
              Tracking link <small>(filled automatically for DHL)</small>
              <input
                type="url"
                value={tracking.url}
                onChange={(e) => setTracking((t) => ({ ...t, url: e.target.value }))}
              />
            </label>
            <button className="adm-btn adm-btn--ghost" type="submit" disabled={action.busy}>
              Save tracking
            </button>
          </form>
        </section>

        <section className="adm-card no-print">
          <h2>Payment</h2>
          <dl className="adm-kv">
            <dt>Provider</dt>
            <dd>{order.payment.provider}</dd>
            <dt>Merchant profile</dt>
            <dd>{order.payment.profileId}</dd>
            <dt>Method</dt>
            <dd>{order.payment.methodType || 'n/a'}</dd>
            <dt>Paid at</dt>
            <dd>{order.paidAt ? formatDate(order.paidAt) : 'n/a'}</dd>
            <dt>Payment ID</dt>
            <dd>
              {order.payment.intentId && order.payment.provider === 'stripe' ? (
                <a
                  href={`https://dashboard.stripe.com/payments/${order.payment.intentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {order.payment.intentId}
                </a>
              ) : (
                order.payment.intentId || 'n/a'
              )}
            </dd>
          </dl>
        </section>

        <section className="adm-card no-print">
          <h2>Internal note</h2>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Only visible to the team"
          />
          <button
            type="button"
            className="adm-btn adm-btn--ghost"
            disabled={action.busy}
            onClick={() => apply(() => adminApi.setNote(order.orderNumber, note))}
          >
            Save note
          </button>
        </section>

        <section className="adm-card no-print">
          <h2>History</h2>
          <ol className="adm-timeline">
            {order.events.map((e, i) => (
              <li key={i}>
                <span>{formatDate(e.at)}</span>
                <strong>{e.from === e.to ? e.note : statusLabel(e.to, 'en')}</strong>
                <small>
                  {e.from !== e.to && e.note ? `${e.note} · ` : ''}
                  {e.actor}
                </small>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
