/**
 * Order lifecycle. Payment states are driven by the payment provider's
 * webhooks; fulfilment states are moved forward by the team in the admin.
 *
 *   pending_payment ─┬─> paid ─> processing ─> shipped ─> delivered
 *                    ├─> payment_failed ─> paid (late async success)
 *                    ├─> expired
 *                    └─> cancelled
 *   paid / processing / shipped / delivered ─> refunded
 */
export const ORDER_STATUSES = Object.freeze([
  'pending_payment',
  'payment_failed',
  'expired',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
  'review_required',
]);

export const STATUS_TRANSITIONS = Object.freeze({
  pending_payment: ['paid', 'payment_failed', 'expired', 'cancelled'],
  payment_failed: ['paid', 'expired', 'cancelled'],
  expired: ['paid'],
  paid: ['processing', 'cancelled', 'refunded'],
  processing: ['shipped', 'cancelled', 'refunded'],
  shipped: ['delivered', 'refunded'],
  delivered: ['refunded'],
  cancelled: ['refunded'],
  refunded: [],
});

/** Statuses the team can set by hand. Payment states only come from the provider. */
export const MANUAL_TRANSITIONS = Object.freeze({
  paid: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  pending_payment: ['cancelled'],
  payment_failed: ['cancelled'],
});

export const PAID_STATUSES = Object.freeze(['paid', 'processing', 'shipped', 'delivered']);

export const STATUS_LABELS = Object.freeze({
  de: {
    review_required: 'Prüfung erforderlich',
    pending_payment: 'Zahlung ausstehend',
    payment_failed: 'Zahlung fehlgeschlagen',
    expired: 'Abgebrochen',
    paid: 'Bezahlt',
    processing: 'In Bearbeitung',
    shipped: 'Versendet',
    delivered: 'Zugestellt',
    cancelled: 'Storniert',
    refunded: 'Erstattet',
  },
  en: {
    review_required: 'Payment needs review',
    pending_payment: 'Awaiting payment',
    payment_failed: 'Payment failed',
    expired: 'Checkout abandoned',
    paid: 'Paid',
    processing: 'Being packed',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
  },
});

export const statusLabel = (status, lang = 'en') =>
  STATUS_LABELS[lang]?.[status] ?? STATUS_LABELS.en[status] ?? status;

export const canTransition = (from, to) => STATUS_TRANSITIONS[from]?.includes(to) ?? false;
export const canSetManually = (from, to) => MANUAL_TRANSITIONS[from]?.includes(to) ?? false;
