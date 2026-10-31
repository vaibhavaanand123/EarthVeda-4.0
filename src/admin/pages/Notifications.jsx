import { adminApi } from '../adminApi';
import { ErrorNote, PageHead, formatDate, useAction, useLoad } from '../ui';

const TEMPLATE_NAMES = {
  order_confirmation: 'Order confirmation',
  order_shipped: 'Shipped',
  order_status: 'Status update',
  merchant_new_order: 'Team: new order',
  newsletter_confirm: 'Newsletter confirmation',
  newsletter_welcome: 'Newsletter welcome',
  withdrawal_receipt: 'Withdrawal receipt',
  merchant_withdrawal: 'Team: withdrawal',
};

export default function Notifications() {
  const { data, error, reload } = useLoad(() => adminApi.notifications(), []);
  const action = useAction();
  return (
    <>
      <PageHead title="Messages">
        <button type="button" className="adm-btn adm-btn--ghost" onClick={reload}>
          Refresh
        </button>
      </PageHead>
      <p className="muted">
        Every email, WhatsApp and webhook the shop sends. Failed messages are retried automatically
        for several hours; "skipped" means the channel is not configured yet.
      </p>
      <ErrorNote message={error || action.error} />
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Created</th>
              <th>Channel</th>
              <th>Message</th>
              <th>To</th>
              <th>Status</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {data?.notifications.map((n) => (
              <tr key={n.id}>
                <td>{formatDate(n.createdAt)}</td>
                <td>{n.channel}</td>
                <td>{TEMPLATE_NAMES[n.template] || n.template}</td>
                <td>{n.recipient}</td>
                <td>
                  <span className={`pill pill--n-${n.status}`}>{n.status}</span>
                  {n.lastError && <small title={n.lastError}>{n.lastError.slice(0, 80)}</small>}
                </td>
                <td>
                  {['failed', 'skipped'].includes(n.status) && (
                    <button
                      type="button"
                      className="adm-btn adm-btn--ghost"
                      onClick={() =>
                        action.run(async () => (await adminApi.retryNotification(n.id), reload()))
                      }
                    >
                      Retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
