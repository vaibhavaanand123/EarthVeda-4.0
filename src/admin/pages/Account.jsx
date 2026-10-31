import { useState } from 'react';
import { adminApi } from '../adminApi';
import { useAdmin } from '../AdminContext';
import { ErrorNote, PageHead, useAction } from '../ui';

export default function Account() {
  const { user, onUnauthorized } = useAdmin();
  const action = useAction();
  const [mfa, setMfa] = useState(null);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const submit = async (e) => {
    e.preventDefault();
    if (await action.run(() => adminApi.changePassword(form))) {
      window.alert('Password changed. Please sign in again.');
      onUnauthorized();
    }
  };
  return (
    <>
      <PageHead title="Your account" />
      <p>
        {user.name} · {user.email} · {user.role}
      </p>
      <section className="adm-card adm-form">
        <h2>Authenticator MFA</h2>
        <ErrorNote message={action.error} />
        {user.mfaEnabled ? (
          <p>Enabled. Keep your authenticator and backup access secure.</p>
        ) : (
          <>
            <p>
              {user.mfaRequired
                ? 'Set up MFA before using the admin panel.'
                : 'Add a second factor to protect your account.'}
            </p>
            {!mfa ? (
              <>
                <label>
                  Current password
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <button
                  className="adm-btn"
                  disabled={action.busy || !password}
                  onClick={async () => {
                    const r = await action.run(() => adminApi.setupMfa(password));
                    if (r) {
                      setMfa(r);
                      setPassword('');
                    }
                  }}
                >
                  Start setup
                </button>
              </>
            ) : (
              <>
                <p>
                  Add an account in your authenticator using this setup key. Keep it private; it
                  expires here in 10 minutes.
                </p>
                <code style={{ overflowWrap: 'anywhere' }}>{mfa.secret}</code>
                <label>
                  Six digit code
                  <input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                  />
                </label>
                <button
                  className="adm-btn"
                  disabled={action.busy || otp.length !== 6}
                  onClick={async () => {
                    if (await action.run(() => adminApi.confirmMfa(otp))) {
                      window.alert('MFA enabled. Sign in with the next authenticator code.');
                      onUnauthorized();
                    }
                  }}
                >
                  Enable MFA
                </button>
              </>
            )}
          </>
        )}
      </section>
      <form className="adm-card adm-form" onSubmit={submit}>
        <h2>Change password</h2>
        <ErrorNote message={action.error} />
        <label>
          Current password
          <input
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
            required
          />
        </label>
        <label>
          New password (12+ characters, letters and numbers)
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            value={form.newPassword}
            onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
            required
          />
        </label>
        <button className="adm-btn" type="submit" disabled={action.busy}>
          Change password
        </button>
      </form>
    </>
  );
}
