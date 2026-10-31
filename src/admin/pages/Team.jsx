import { useState } from 'react';
import { adminApi } from '../adminApi';
import { useAdmin } from '../AdminContext';
import { ErrorNote, PageHead, formatDate, useAction, useLoad } from '../ui';

export default function Team() {
  const { user: me } = useAdmin();
  const { data, error, reload } = useLoad(() => adminApi.users(), []);
  const audit = useLoad(() => adminApi.audit(), []);
  const action = useAction();
  const [form, setForm] = useState({ email: '', name: '', role: 'staff', password: '' });

  const create = async (e) => {
    e.preventDefault();
    if (await action.run(() => adminApi.createUser(form))) {
      setForm({ email: '', name: '', role: 'staff', password: '' });
      reload();
    }
  };
  const update = (u, patch) =>
    action.run(
      async () => (
        await adminApi.updateUser(u.id, { name: u.name, role: u.role, active: u.active, ...patch }),
        reload()
      ),
    );
  const reset = (u) => {
    const password = window.prompt(
      `New password for ${u.email} (12+ characters, letters and numbers):`,
    );
    if (password) action.run(() => adminApi.resetPassword(u.id, password));
  };

  return (
    <>
      <PageHead title="Team" />
      <p className="muted">
        Owners can change settings and manage the team. Staff can work orders, products, the story
        and the newsletter list.
      </p>
      <ErrorNote message={error || action.error} />
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Last sign-in</th>
              <th>Active</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {data?.users.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.name}
                  <small>{u.email}</small>
                </td>
                <td>
                  <select
                    value={u.role}
                    disabled={u.id === me.id}
                    onChange={(e) => update(u, { role: e.target.value })}
                    aria-label={`Role of ${u.email}`}
                  >
                    <option value="staff">Staff</option>
                    <option value="owner">Owner</option>
                  </select>
                </td>
                <td>{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'never'}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={u.active}
                    disabled={u.id === me.id}
                    onChange={(e) => update(u, { active: e.target.checked })}
                    aria-label={`${u.email} active`}
                  />
                </td>
                <td>
                  <button type="button" className="adm-btn adm-btn--ghost" onClick={() => reset(u)}>
                    Reset password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="adm-card adm-form adm-form--2" onSubmit={create}>
        <h2>Add a team member</h2>
        <label>
          Name
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
        </label>
        <label>
          Role
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          >
            <option value="staff">Staff</option>
            <option value="owner">Owner</option>
          </select>
        </label>
        <label>
          First password <small>(share it securely; they can change it)</small>
          <input
            type="text"
            autoComplete="new-password"
            minLength={12}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required
          />
        </label>
        <button className="adm-btn" type="submit" disabled={action.busy}>
          Add member
        </button>
      </form>

      <section className="adm-card">
        <h2>Activity log</h2>
        <ul className="adm-audit">
          {audit.data?.entries.map((e) => (
            <li key={e.id}>
              <span>{formatDate(e.at)}</span> <strong>{e.actor}</strong> {e.action}{' '}
              {e.entityId && <code>{e.entityId}</code>}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
