import { AlertTriangle, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../adminApi';
import { ErrorNote, PageHead, formatEuro, useAction, useLoad } from '../ui';

/** What German food law needs on the listing that is still missing. */
export function complianceGaps(p) {
  const gaps = [];
  if (!p.netWeightGrams) gaps.push('net weight (needed for price per kg)');
  if (!p.i18n?.de?.ingredients || !p.i18n?.en?.ingredients) gaps.push('ingredients');
  if (!p.i18n?.de?.allergens && !p.i18n?.en?.allergens) gaps.push('allergens');
  if (!p.nutrition) gaps.push('nutrition table');
  return gaps;
}

function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className="adm-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span aria-hidden="true" />
      {label}
    </label>
  );
}

export default function Products() {
  const { data, error, setData } = useLoad(() => adminApi.products(), []);
  const action = useAction();
  const [showArchived, setShowArchived] = useState(false);
  const products = data?.products ?? [];
  const replace = (product) =>
    setData({ products: products.map((p) => (p.id === product.id ? product : p)) });
  const flag = (p, key, value) =>
    action.run(async () =>
      replace((await adminApi.setFlags(p.id, { [key]: value, version: p.version })).product),
    );
  const archive = (p) => {
    if (
      !window.confirm(
        `Discard "${p.i18n.en.name}"? It disappears from the shop. Past orders keep it, and you can restore it later.`,
      )
    )
      return;
    action.run(async () => replace((await adminApi.archive(p.id)).product));
  };
  const restore = (p) => action.run(async () => replace((await adminApi.restore(p.id)).product));

  const live = products.filter((p) => !p.archivedAt);
  const archived = products.filter((p) => p.archivedAt);

  const row = (p) => {
    const gaps = complianceGaps(p);
    return (
      <tr key={p.id} className={p.archivedAt ? 'is-muted' : ''}>
        <td>
          <img
            src={p.image}
            alt=""
            width="48"
            height="64"
            className="adm-thumb"
            style={{ background: p.accent }}
          />
        </td>
        <td>
          <Link to={`/admin/products/${p.id}`}>
            <strong>{p.i18n.en.name}</strong>
          </Link>
          <small>
            {p.sku} · {p.range}
            {p.bundleEligible ? ' · in boxes' : ''}
          </small>
          {gaps.length > 0 && !p.archivedAt && (
            <small className="adm-warn">
              <AlertTriangle size={12} aria-hidden="true" /> Missing: {gaps.join(', ')}
            </small>
          )}
        </td>
        <td className="num">{formatEuro(p.price)}</td>
        <td>
          {!p.archivedAt && (
            <>
              <Toggle
                checked={p.active}
                onChange={(v) => flag(p, 'active', v)}
                label="Shown in shop"
                disabled={action.busy}
              />
              <Toggle
                checked={p.inStock}
                onChange={(v) => flag(p, 'inStock', v)}
                label="In stock"
                disabled={action.busy}
              />
            </>
          )}
        </td>
        <td className="adm-row-actions">
          <Link className="adm-btn adm-btn--ghost" to={`/admin/products/${p.id}`}>
            Edit
          </Link>
          {p.archivedAt ? (
            <button type="button" className="adm-btn adm-btn--ghost" onClick={() => restore(p)}>
              Restore
            </button>
          ) : (
            <button
              type="button"
              className="adm-btn adm-btn--ghost adm-btn--danger-text"
              onClick={() => archive(p)}
            >
              Discard
            </button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <>
      <PageHead title="Products">
        <Link className="adm-btn" to="/admin/products/new">
          <Plus size={16} aria-hidden="true" /> Add product
        </Link>
      </PageHead>
      <p className="muted">
        Changes go live in the shop within a minute. "Shown in shop" hides a product without
        deleting it; "Discard" removes it from this list too.
      </p>
      <ErrorNote message={error || action.error} />
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th aria-label="Image" />
              <th>Product</th>
              <th className="num">Price</th>
              <th>Visibility</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>{live.map(row)}</tbody>
        </table>
      </div>
      {archived.length > 0 && (
        <details
          className="adm-archived"
          open={showArchived}
          onToggle={(e) => setShowArchived(e.target.open)}
        >
          <summary>Discarded products ({archived.length})</summary>
          <table className="adm-table">
            <tbody>{archived.map(row)}</tbody>
          </table>
        </details>
      )}
    </>
  );
}
