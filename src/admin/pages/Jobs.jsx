import { adminApi } from '../adminApi';
import { ErrorNote, PageHead, formatDate, useAction, useLoad } from '../ui';
export default function Jobs() {
  const { data, error, reload } = useLoad(() => adminApi.jobs(), []);
  const action = useAction();
  return (
    <>
      <PageHead title="Refund jobs">
        <button className="adm-btn" onClick={reload}>
          Refresh
        </button>
      </PageHead>
      <p>
        “Sent” means the request reached the payment provider. Confirmed refunded amounts appear on
        the order after reconciliation. Investigate failed jobs before retrying.
      </p>
      <ErrorNote message={error || action.error} />
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Created</th>
              <th>Order</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data?.jobs.map((j) => (
              <tr key={j.id}>
                <td>{formatDate(j.createdAt)}</td>
                <td>{j.recipient}</td>
                <td>
                  {j.status}
                  {j.lastError && <small>{j.lastError}</small>}
                </td>
                <td>{j.attempts}</td>
                <td>
                  {j.status === 'failed' && (
                    <button
                      className="adm-btn adm-btn--ghost"
                      onClick={() =>
                        action.run(async () => {
                          await adminApi.retryJob(j.id);
                          reload();
                        })
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
