import { apiRequest } from './apiClient';

/** Storefront API calls (one place, so pages never build URLs themselves). */
export const shopApi = {
  storefront: ({ signal, fresh } = {}) =>
    apiRequest('/storefront', { signal, cache: fresh ? 'reload' : 'default' }),
  checkout: (body, idempotencyKey) =>
    // Longer than the server's payment-provider timeout, so the browser never gives up first.
    apiRequest('/checkout', {
      method: 'POST',
      body,
      headers: { 'Idempotency-Key': idempotencyKey },
      timeout: 45000,
    }),
  orderStatus: (orderNumber, sessionId) =>
    apiRequest(
      `/orders/${encodeURIComponent(orderNumber)}/status?session_id=${encodeURIComponent(sessionId)}`,
      {
        cache: 'no-store',
      },
    ),
  lookup: (body) => apiRequest('/orders/lookup', { method: 'POST', body }),
  subscribe: (body) => apiRequest('/newsletter/subscribe', { method: 'POST', body }),
  confirmNewsletter: (token) =>
    apiRequest('/newsletter/confirm', { method: 'POST', body: { token } }),
  unsubscribe: (token) =>
    apiRequest('/newsletter/unsubscribe', { method: 'POST', body: { token } }),
  withdraw: (body) => apiRequest('/withdrawals', { method: 'POST', body }),
  mockPayment: (sessionId, outcome) =>
    apiRequest('/dev/mock-payment', { method: 'POST', body: { sessionId, outcome } }),
};
