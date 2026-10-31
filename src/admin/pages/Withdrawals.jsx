import { Link } from 'react-router-dom';
import { adminApi } from '../adminApi';
import { ErrorNote, PageHead, formatDate, useAction, useLoad } from '../ui';

export default function Withdrawals() {
  const { data, error, reload } = useLoad(() => adminApi.withdrawals(), []);
  const action = useAction();
  const toggle = (w) =>
    action.run(async () => {
      await adminApi.setWithdrawalHandled(w.id, !w.handled);
      reload();
    });
  return (
    <>
      <PageHead title="Withdrawals" />
      <p className="muted">
        Declarations made with the "Withdraw from contract" button. The customer already received an
        acknowledgement of receipt. Check the period and exceptions (opened food packs), arrange the
        return and refund the order.
      </p>
      <ErrorNote message={error || action.error} />
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Received</th>
              <th>Reference</th>
              <th>Order</th>
              <th>Customer</th>
              <th>Scope</th>
              <th>Done</th>
            </tr>
          </thead>
          <tbody>
            {data?.withdrawals.length ? (
              data.withdrawals.map((w) => (
                <tr key={w.id} className={w.handled ? 'is-muted' : ''}>
                  <td>{formatDate(w.createdAt)}</td>
                  <td>{w.reference}</td>
                  <td>
                    <Link to={`/admin/orders/${w.orderNumber}`}>{w.orderNumber}</Link>
                  </td>
                  <td>
                    {w.name}
                    <small>{w.email}</small>
                  </td>
                  <td>{w.scope || 'Entire contract'}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={w.handled}
                      onChange={() => toggle(w)}
                      aria-label={`Mark ${w.reference} as handled`}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>No withdrawals.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
