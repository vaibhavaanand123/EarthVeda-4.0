import { config } from '../config';

export class ApiError extends Error {
  constructor(status, code, message, fields = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    /** Field-level validation messages: [{ path: 'customer.phone', message }] */
    this.fields = fields;
  }
}

const TIMEOUT_MS = 20000;

/** JSON fetch with timeout and typed errors. Admin calls add the CSRF header. */
export async function apiRequest(
  path,
  {
    method = 'GET',
    body,
    headers,
    signal,
    raw = false,
    admin = false,
    cache = 'default',
    timeout = TIMEOUT_MS,
  } = {},
) {
  // Prevent every accidental API request on a standalone Vercel preview.
  if (config.preview)
    throw new ApiError(503, 'preview_mode', 'This feature opens with the live shop.');
  // Manual controller instead of AbortSignal.any/timeout: works on older mobile browsers.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener('abort', forwardAbort, { once: true });
  const isBinary = body instanceof Blob || body instanceof ArrayBuffer;
  let response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body && !isBinary ? { 'Content-Type': 'application/json' } : {}),
        ...(admin ? { 'X-EV-Admin': '1' } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isBinary ? body : JSON.stringify(body),
      credentials: 'same-origin',
      cache,
      signal: controller.signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(0, timedOut ? 'timeout' : 'network', timedOut ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = payload?.error || {};
    throw new ApiError(
      response.status,
      error.code || 'http_error',
      error.message || 'The request could not be completed.',
      error.fields || [],
    );
  }
  if (raw) return response;
  return response.status === 204 ? null : response.json();
}
