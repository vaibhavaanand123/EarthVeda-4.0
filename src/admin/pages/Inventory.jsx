import { useState } from 'react';
import { adminApi } from '../adminApi';
import { ErrorNote, PageHead, useAction, useLoad } from '../ui';
export default function Inventory() {
  const { data, error, reload } = useLoad(() => adminApi.inventory(), []);
  const action = useAction();
  const [form, setForm] = useState({ productId: '', country: 'DE', delta: 1, reason: '' });
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  async function submit(e) {
    e.preventDefault();
    const result = await action.run(() =>
      adminApi.adjustInventory({ ...form, delta: Number(form.delta), operationId }),
    );
    if (result) {
      setOperationId(crypto.randomUUID());
      setForm((f) => ({ ...f, reason: '' }));
      reload();
    }
  }
  return (
    <>
      <PageHead title="Inventory" />
      <p>
        Available = on hand − reserved for unpaid checkouts. Paid orders consume stock. Refunds
        require a separate, inspected return adjustment.
      </p>
      <ErrorNote message={error || action.error} />
      <form className="adm-card adm-form adm-form--2" onSubmit={submit}>
        <label>
          Product
          <select
            required
            value={form.productId}
            onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
          >
            <option value="">Choose product</option>
            {data?.products.map((p) => (
              <option value={p.id} key={p.id}>
                {p.sku} · {p.i18n.en.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Market
          <select
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
          >
            <option value="DE">Germany</option>
            <option value="GB">UK</option>
          </select>
        </label>
        <label>
          Adjustment (+ receive, − remove)
          <input
            required
            type="number"
            min="-1000000"
            max="1000000"
            value={form.delta}
            onChange={(e) => setForm((f) => ({ ...f, delta: e.target.value }))}
          />
        </label>
        <label>
          Reason
          <input
            required
            minLength={3}
            maxLength={200}
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder="Delivery received, batch reference…"
          />
        </label>
        <button className="adm-btn" disabled={action.busy}>
          Record adjustment
        </button>
      </form>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Market</th>
              <th>On hand</th>
              <th>Reserved</th>
              <th>Available</th>
            </tr>
          </thead>
          <tbody>
            {data?.inventory.map((s) => (
              <tr key={s.id}>
                <td>{data.products.find((p) => p.id === s.productId)?.sku || s.productId}</td>
                <td>{s.country}</td>
                <td>{s.onHand}</td>
                <td>{s.reserved}</td>
                <td>{s.available}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
