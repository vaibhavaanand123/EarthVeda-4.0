import { useState } from 'react';
import { COUNTRIES } from '../../../shared/markets.js';
import { adminApi } from '../adminApi';
import { ErrorNote, PageHead, euroInput, parseEuro, useAction, useLoad } from '../ui';

/**
 * Controlled euro field: keeps what the user types ("4,9") and reports cents on
 * every keystroke, so pressing Enter saves the latest value.
 */
function EuroInput({ cents, onChange, optional = false }) {
  const [text, setText] = useState(cents == null ? '' : euroInput(cents));
  return (
    <input
      inputMode="decimal"
      value={text}
      required={!optional}
      onChange={(e) => {
        setText(e.target.value);
        if (optional && e.target.value.trim() === '') return onChange(null);
        const value = parseEuro(e.target.value);
        if (Number.isFinite(value)) onChange(value);
      }}
    />
  );
}

function Section({ title, description, onSave, busy, children }) {
  return (
    <form
      className="adm-card adm-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <h2>{title}</h2>
      {description && <p className="muted">{description}</p>}
      {children}
      <button className="adm-btn" type="submit" disabled={busy}>
        Save
      </button>
    </form>
  );
}

const BUSINESS_FIELDS = [
  ['brand', 'Brand name'],
  ['legalName', 'Legal company name'],
  ['legalForm', 'Legal form (e.g. GmbH, UG)'],
  ['street', 'Street and number'],
  ['postalCode', 'Postcode'],
  ['city', 'City'],
  ['country', 'Country'],
  ['email', 'Customer service email'],
  ['phone', 'Phone (optional)'],
  ['managingDirectors', 'Managing director(s)'],
  ['registerCourt', 'Register court (e.g. Amtsgericht Berlin-Charlottenburg)'],
  ['registerNumber', 'Register number (e.g. HRB 123456 B)'],
  ['vatId', 'German VAT ID (DE...)'],
  ['ukVatNumber', 'UK VAT number (GB...)'],
  ['contentResponsible', 'Responsible for content (name, address)'],
  ['packagingRegister', 'LUCID packaging register number'],
  ['foodBusinessOperator', 'Food business operator (name and address shown on product pages)'],
  ['instagram', 'Instagram URL'],
];

export default function SettingsPage() {
  const { data, error } = useLoad(() => adminApi.settings(), []);
  if (error) return <ErrorNote message={error} />;
  if (!data) return <p>Loading…</p>;
  return <SettingsEditor initialSettings={data.settings} />;
}

function SettingsEditor({ initialSettings }) {
  const action = useAction();
  const [s, setS] = useState(initialSettings);
  const [saved, setSaved] = useState('');

  const save = async (key, value, label) => {
    setSaved('');
    const res = await action.run(() => adminApi.saveSetting(key, value));
    if (res) {
      setS((x) => ({ ...x, [key]: res.value }));
      setSaved(`${label} saved.`);
    }
  };
  const patch = (key, value) => setS((x) => ({ ...x, [key]: value }));

  return (
    <>
      <PageHead title="Settings" />
      <ErrorNote message={action.error} />
      {saved && (
        <p className="adm-ok" role="status">
          {saved}
        </p>
      )}
      <div className="adm-two">
        <Section
          title="Shipping"
          description="Flat rate per country. Leave 'free from' empty for no free shipping."
          busy={action.busy}
          onSave={() => save('shipping', s.shipping, 'Shipping')}
        >
          {Object.keys(COUNTRIES).map((code) => {
            const r = s.shipping[code];
            const set = (p) => patch('shipping', { ...s.shipping, [code]: { ...r, ...p } });
            return (
              <fieldset key={code} className="adm-form adm-form--2">
                <legend>{COUNTRIES[code].name.en}</legend>
                <label>
                  Fee (€)
                  <EuroInput cents={r.fee} onChange={(fee) => set({ fee })} />
                </label>
                <label>
                  Free from (€)
                  <EuroInput
                    cents={r.freeFrom}
                    optional
                    onChange={(freeFrom) => set({ freeFrom })}
                  />
                </label>
                <label>
                  Delivery time (DE)
                  <input
                    value={r.eta.de}
                    onChange={(e) => set({ eta: { ...r.eta, de: e.target.value } })}
                  />
                </label>
                <label>
                  Delivery time (EN)
                  <input
                    value={r.eta.en}
                    onChange={(e) => set({ eta: { ...r.eta, en: e.target.value } })}
                  />
                </label>
                <label>
                  Carrier
                  <input value={r.carrier} onChange={(e) => set({ carrier: e.target.value })} />
                </label>
              </fieldset>
            );
          })}
        </Section>

        <Section
          title="Flavour boxes"
          description="Boxes are filled with foxnuts marked 'Can be chosen for boxes', two packs per flavour."
          busy={action.busy}
          onSave={() => save('bundles', s.bundles, 'Boxes')}
        >
          {s.bundles.map((b, i) => {
            const set = (p) =>
              patch(
                'bundles',
                s.bundles.map((x, j) => (j === i ? { ...x, ...p } : x)),
              );
            return (
              <fieldset key={b.id} className="adm-form adm-form--2">
                <legend>
                  {b.name.en} <small>({b.id})</small>
                </legend>
                <label>
                  Packs
                  <input
                    type="number"
                    min="2"
                    max="48"
                    step="2"
                    value={b.size}
                    onChange={(e) => set({ size: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Price (€)
                  <EuroInput cents={b.price} onChange={(price) => set({ price })} />
                </label>
                <label>
                  Name (DE)
                  <input
                    value={b.name.de}
                    onChange={(e) => set({ name: { ...b.name, de: e.target.value } })}
                  />
                </label>
                <label>
                  Name (EN)
                  <input
                    value={b.name.en}
                    onChange={(e) => set({ name: { ...b.name, en: e.target.value } })}
                  />
                </label>
                <label className="adm-check">
                  <input
                    type="checkbox"
                    checked={b.active}
                    onChange={(e) => set({ active: e.target.checked })}
                  />{' '}
                  Available
                </label>
              </fieldset>
            );
          })}
        </Section>

        <Section
          title="Order alerts"
          description="Who gets an email and a WhatsApp message for every paid order and every online withdrawal."
          busy={action.busy}
          onSave={() => save('notifications', s.notifications, 'Order alerts')}
        >
          <label>
            Team emails (one per line)
            <textarea
              rows={3}
              value={s.notifications.merchantEmails.join('\n')}
              onChange={(e) =>
                patch('notifications', {
                  ...s.notifications,
                  merchantEmails: e.target.value
                    .split('\n')
                    .map((x) => x.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <label>
            Team WhatsApp numbers, international format (one per line)
            <textarea
              rows={2}
              placeholder="+4915112345678"
              value={s.notifications.merchantWhatsApp.join('\n')}
              onChange={(e) =>
                patch('notifications', {
                  ...s.notifications,
                  merchantWhatsApp: e.target.value
                    .split('\n')
                    .map((x) => x.replace(/[\s()-]/g, ''))
                    .filter(Boolean),
                })
              }
            />
          </label>
        </Section>

        <Section
          title="Newsletter offer"
          description="Create the discount as a promotion code in Stripe (Products → Coupons), then enter the same code here. It is sent in the welcome email and the shop advertises the offer text. Leave empty for no offer."
          busy={action.busy}
          onSave={() => save('newsletter', s.newsletter, 'Newsletter offer')}
        >
          <label>
            Welcome code
            <input
              value={s.newsletter.welcomeCode}
              onChange={(e) =>
                patch('newsletter', { ...s.newsletter, welcomeCode: e.target.value.toUpperCase() })
              }
              placeholder="WELCOME10"
            />
          </label>
          <label>
            Offer text (DE)
            <input
              value={s.newsletter.incentive.de}
              onChange={(e) =>
                patch('newsletter', {
                  ...s.newsletter,
                  incentive: { ...s.newsletter.incentive, de: e.target.value },
                })
              }
            />
          </label>
          <label>
            Offer text (EN)
            <input
              value={s.newsletter.incentive.en}
              onChange={(e) =>
                patch('newsletter', {
                  ...s.newsletter,
                  incentive: { ...s.newsletter.incentive, en: e.target.value },
                })
              }
            />
          </label>
        </Section>
      </div>

      <Section
        title="Business and legal details"
        description="Shown in the legal notice (Impressum), terms, privacy policy, emails and product pages. German law requires these before you sell."
        busy={action.busy}
        onSave={() => save('business', s.business, 'Business details')}
      >
        <div className="adm-form adm-form--2">
          {BUSINESS_FIELDS.map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                value={s.business[key] ?? ''}
                onChange={(e) => patch('business', { ...s.business, [key]: e.target.value })}
              />
            </label>
          ))}
          <label>
            Support hours (DE)
            <input
              value={s.business.supportHours.de}
              onChange={(e) =>
                patch('business', {
                  ...s.business,
                  supportHours: { ...s.business.supportHours, de: e.target.value },
                })
              }
            />
          </label>
          <label>
            Support hours (EN)
            <input
              value={s.business.supportHours.en}
              onChange={(e) =>
                patch('business', {
                  ...s.business,
                  supportHours: { ...s.business.supportHours, en: e.target.value },
                })
              }
            />
          </label>
        </div>
      </Section>
    </>
  );
}
