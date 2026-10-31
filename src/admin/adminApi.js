import { apiRequest } from '../services/apiClient';

const a = (path, options = {}) =>
  apiRequest(`/admin${path}`, { admin: true, cache: 'no-store', ...options });
const qs = (params) => {
  const s = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null),
  );
  return s.toString() ? `?${s}` : '';
};

/** Every admin endpoint in one place. */
export const adminApi = {
  me: () => a('/me'),
  login: (email, password, otp) => a('/login', { method: 'POST', body: { email, password, otp } }),
  setupMfa: (password) => a('/me/mfa/setup', { method: 'POST', body: { password } }),
  confirmMfa: (otp) => a('/me/mfa/confirm', { method: 'POST', body: { otp } }),
  inventory: () => a('/inventory'),
  adjustInventory: (body) => a('/inventory/adjust', { method: 'POST', body }),
  generateSku: (range) => a('/skus', { method: 'POST', body: { range } }),
  jobs: () => a('/jobs'),
  retryJob: (id) => a(`/jobs/${id}/retry`, { method: 'POST' }),
  logout: () => a('/logout', { method: 'POST' }),
  changePassword: (body) => a('/me/password', { method: 'POST', body }),

  summary: () => a('/summary'),
  feed: (since) => a(`/orders/feed${qs({ since })}`),
  orders: (params) => a(`/orders${qs(params)}`),
  ordersCsvUrl: (params) => `/api/admin/orders.csv${qs(params)}`,
  order: (n) => a(`/orders/${encodeURIComponent(n)}`),
  setStatus: (n, body) => a(`/orders/${encodeURIComponent(n)}/status`, { method: 'PATCH', body }),
  setTracking: (n, body) => a(`/orders/${encodeURIComponent(n)}/tracking`, { method: 'PUT', body }),
  setNote: (n, note) =>
    a(`/orders/${encodeURIComponent(n)}/note`, { method: 'PUT', body: { note } }),
  refund: (n, body) => a(`/orders/${encodeURIComponent(n)}/refund`, { method: 'POST', body }),

  products: () => a('/products'),
  product: (id) => a(`/products/${encodeURIComponent(id)}`),
  createProduct: (body) => a('/products', { method: 'POST', body }),
  updateProduct: (id, body) => a(`/products/${encodeURIComponent(id)}`, { method: 'PUT', body }),
  setFlags: (id, body) => a(`/products/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  archive: (id) => a(`/products/${encodeURIComponent(id)}/archive`, { method: 'POST' }),
  restore: (id) => a(`/products/${encodeURIComponent(id)}/restore`, { method: 'POST' }),
  upload: (file) =>
    a('/uploads', {
      method: 'POST',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    }),

  settings: () => a('/settings'),
  saveSetting: (key, value) => a(`/settings/${key}`, { method: 'PUT', body: value }),

  subscribers: (params) => a(`/subscribers${qs(params)}`),
  subscribersCsvUrl: '/api/admin/subscribers.csv',
  deleteSubscriber: (id) => a(`/subscribers/${id}`, { method: 'DELETE' }),

  withdrawals: () => a('/withdrawals'),
  setWithdrawalHandled: (id, handled) =>
    a(`/withdrawals/${id}`, { method: 'PATCH', body: { handled } }),

  notifications: () => a('/notifications'),
  retryNotification: (id) => a(`/notifications/${id}/retry`, { method: 'POST' }),

  users: () => a('/users'),
  createUser: (body) => a('/users', { method: 'POST', body }),
  updateUser: (id, body) => a(`/users/${id}`, { method: 'PUT', body }),
  resetPassword: (id, password) =>
    a(`/users/${id}/password`, { method: 'POST', body: { password } }),
  audit: () => a('/audit'),
};
