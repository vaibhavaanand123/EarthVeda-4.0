import { Download } from 'lucide-react';
import { useState } from 'react';
import { adminApi } from '../adminApi';
import { ErrorNote, PageHead, formatDate, useAction, useLoad } from '../ui';

export default function Subscribers() {
  const [status, setStatus] = useState('confirmed');
  const { data, error, reload } = useLoad(
    () => adminApi.subscribers({ status: status || undefined, limit: 500 }),
    [status],
  );
  const action = useAction();
  const remove = (s) => {
    if (!window.confirm(`Delete ${s.email} permanently (GDPR erasure)?`)) return;
    action.run(async () => {
      await adminApi.deleteSubscriber(s.id);
      reload();
    });
  };
  return (
    <>
      <PageHead title="Newsletter">
        <a className="adm-btn adm-btn--ghost" href={adminApi.subscribersCsvUrl}>
          <Download size={16} aria-hidden="true" /> Export confirmed (CSV)
        </a>
      </PageHead>
      <p className="muted">
        Double opt-in: only "confirmed" addresses may receive marketing email. Import the CSV into
        your newsletter tool (Brevo, Mailchimp, Klaviyo).
      </p>
      <div className="adm-tabs">
        {[
          ['confirmed', 'Confirmed'],
          ['pending', 'Waiting for confirmation'],
          ['unsubscribed', 'Unsubscribed'],
          ['', 'All'],
        ].map(([v, l]) => (
          <button
            key={v || 'all'}
            type="button"
            className={status === v ? 'is-on' : ''}
            onClick={() => setStatus(v)}
          >
            {l}
          </button>
        ))}
      </div>
      <ErrorNote message={error || action.error} />
      <p>{data?.total ?? 0} addresses</p>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Status</th>
              <th>Language</th>
              <th>Source</th>
              <th>Signed up</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {data?.subscribers.map((s) => (
              <tr key={s.id}>
                <td>{s.email}</td>
                <td>{s.status}</td>
                <td>{s.lang.toUpperCase()}</td>
                <td>{s.source}</td>
                <td>{formatDate(s.confirmedAt || s.createdAt)}</td>
                <td>
                  <button
                    type="button"
                    className="adm-btn adm-btn--ghost adm-btn--danger-text"
                    onClick={() => remove(s)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
