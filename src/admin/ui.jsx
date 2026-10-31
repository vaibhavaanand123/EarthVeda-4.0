import { useCallback, useEffect, useState } from 'react';
import { formatDateTime, formatMoney } from '../../shared/markets.js';
import { statusLabel } from '../../shared/orderStatus.js';
import { useAdmin } from './AdminContext';

export const formatEuro = (cents) => formatMoney(cents, 'de');
export const formatDate = (iso) => formatDateTime(iso, 'en');

/** Load data with loading/error state; 401 sends the user back to the login. */
export function useLoad(loader, deps = []) {
  const { onUnauthorized } = useAdmin();
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    return loader()
      .then((data) => setState({ data, loading: false, error: '' }))
      .catch((error) => {
        if (error.status === 401) onUnauthorized();
        setState({ data: null, loading: false, error: error.message });
      });
    // This shared loader hook deliberately uses the dependencies supplied by its caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  }, deps);
  useEffect(() => {
    reload();
  }, [reload]);
  return { ...state, reload, setData: (data) => setState((s) => ({ ...s, data })) };
}

/** Run a mutation and surface its error message. */
export function useAction() {
  const { onUnauthorized } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = useCallback(
    async (fn) => {
      setBusy(true);
      setError('');
      try {
        return await fn();
      } catch (e) {
        if (e.status === 401) onUnauthorized();
        const fields = e.fields?.length
          ? `: ${e.fields.map((f) => `${f.path} ${f.message}`).join('; ')}`
          : '';
        setError(`${e.message}${fields}`);
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [onUnauthorized],
  );
  return { busy, error, run, setError };
}

export function StatusPill({ status }) {
  return <span className={`pill pill--${status}`}>{statusLabel(status, 'en')}</span>;
}

export function PageHead({ title, children }) {
  return (
    <header className="adm-head">
      <h1>{title}</h1>
      <div className="adm-head__actions">{children}</div>
    </header>
  );
}

export function ErrorNote({ message }) {
  return message ? (
    <p className="adm-error" role="alert">
      {message}
    </p>
  ) : null;
}

export const euroInput = (cents) => (Number.isFinite(cents) ? (cents / 100).toFixed(2) : '');
export const parseEuro = (text) => {
  const n = Number(String(text).replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
