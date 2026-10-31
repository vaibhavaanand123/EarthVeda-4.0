import { Download, Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adminApi } from '../adminApi';
import { ErrorNote, PageHead, StatusPill, formatDate, formatEuro, useLoad } from '../ui';

const FILTERS = [
  ['open', 'To pack'],
  ['', 'All'],
  ['pending_payment', 'Awaiting payment'],
  ['shipped', 'Shipped'],
  ['delivered', 'Delivered'],
  ['cancelled', 'Cancelled'],
  ['refunded', 'Refunded'],
  ['payment_failed', 'Payment failed'],
  ['expired', 'Abandoned'],
];
const PAGE = 50;

function Summary() {
  const { data } = useLoad(() => adminApi.summary(), []);
  if (!data) return null;
  const s = data.summary;
  const count = (st) => s.byStatus.find((x) => x.status === st)?.count ?? 0;
  return (
    <div className="adm-tiles">
      <div>
        <span>Revenue, last 30 days</span>
        <strong>{formatEuro(s.revenue)}</strong>
      </div>
      <div>
        <span>Paid orders, last 30 days</span>
        <strong>{s.orders}</strong>
      </div>
      <div className={count('paid') ? 'is-hot' : ''}>
        <span>New, not yet packed</span>
        <strong>{count('paid')}</strong>
      </div>
      <div>
        <span>Being packed</span>
        <strong>{count('processing')}</strong>
      </div>
    </div>
  );
}

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const status = params.get('status') ?? 'open';
  const page = Number(params.get('page') || 0);
  const [search, setSearch] = useState(params.get('q') || '');
  const q = params.get('q') || '';
  const { data, loading, error } = useLoad(
    () =>
      adminApi.orders({
        status: status || undefined,
        search: q || undefined,
        limit: PAGE,
        offset: page * PAGE,
      }),
    [status, q, page],
  );
  const update = (next) => setParams({ status, q, page: 0, ...next }, { replace: true });

  return (
    <>
      <PageHead title="Orders">
        <a
          className="adm-btn adm-btn--ghost"
          href={adminApi.ordersCsvUrl({ status: status || undefined, search: q || undefined })}
        >
          <Download size={16} aria-hidden="true" /> Export CSV
        </a>
      </PageHead>
      <Summary />
      <div className="adm-toolbar">
        <div className="adm-tabs" role="group" aria-label="Filter by status">
          {FILTERS.map(([value, label]) => (
            <button
              key={value || 'all'}
              type="button"
              className={status === value ? 'is-on' : ''}
              onClick={() => update({ status: value })}
            >
              {label}
            </button>
          ))}
        </div>
        <form
          className="adm-search"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: search.trim() });
          }}
        >
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Order no., name, email, phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search orders"
          />
        </form>
      </div>
      <ErrorNote message={error} />
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Ship to</th>
              <th>Items</th>
              <th className="num">Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr>
                <td colSpan={7}>Loading…</td>
              </tr>
            ) : data?.orders.length ? (
              data.orders.map((o) => (
                <tr
                  key={o.orderNumber}
                  className="is-link"
                  onClick={() => navigate(`/admin/orders/${o.orderNumber}`)}
                >
                  <td>
                    <a href={`/admin/orders/${o.orderNumber}`} onClick={(e) => e.preventDefault()}>
                      <strong>{o.orderNumber}</strong>
                    </a>
                  </td>
                  <td>{formatDate(o.createdAt)}</td>
                  <td>
                    {o.customer.firstName} {o.customer.lastName}
                    <small>{o.customer.email}</small>
                  </td>
                  <td>
                    {o.customer.city}, {o.country}
                  </td>
                  <td>
                    {o.lines.reduce(
                      (n, l) =>
                        n +
                        (l.picks
                          ? l.picks.reduce((m, p) => m + p.quantity, 0) * l.quantity
                          : l.quantity),
                      0,
                    )}{' '}
                    packs
                  </td>
                  <td className="num">{formatEuro(o.amountPaid ?? o.total)}</td>
                  <td>
                    <StatusPill status={o.status} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>No orders here yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {data && data.total > PAGE && (
        <div className="adm-pager">
          <button
            type="button"
            className="adm-btn adm-btn--ghost"
            disabled={page === 0}
            onClick={() => update({ page: page - 1 })}
          >
            Previous
          </button>
          <span>
            {page * PAGE + 1} to {Math.min((page + 1) * PAGE, data.total)} of {data.total}
          </span>
          <button
            type="button"
            className="adm-btn adm-btn--ghost"
            disabled={(page + 1) * PAGE >= data.total}
            onClick={() => update({ page: page + 1 })}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
