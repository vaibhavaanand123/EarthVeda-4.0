import { ArrowLeft, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CATALOG_PRICES, RANGES } from '../../../shared/catalog.js';
import { adminApi } from '../adminApi';
import { ErrorNote, PageHead, euroInput, parseEuro, useAction } from '../ui';
import { complianceGaps } from './Products';

const TEXT_FIELDS = [
  ['name', 'Short name (card, cart)', 'input'],
  ['fullName', 'Full product name (product page, invoice)', 'input'],
  ['description', 'Description', 'textarea'],
  ['ingredients', 'Ingredients (as printed on the pack, allergens in CAPITALS)', 'textarea'],
  ['allergens', 'Allergen note, e.g. "May contain traces of nuts"', 'input'],
  ['storage', 'Storage', 'input'],
  ['howToEnjoy', 'How to enjoy', 'textarea'],
];
const NUTRIENTS = [
  ['energyKj', 'Energy kJ'],
  ['energyKcal', 'Energy kcal'],
  ['fat', 'Fat g'],
  ['saturates', 'of which saturates g'],
  ['carbs', 'Carbohydrate g'],
  ['sugars', 'of which sugars g'],
  ['fibre', 'Fibre g'],
  ['protein', 'Protein g'],
  ['salt', 'Salt g'],
];
const emptyText = {
  name: '',
  fullName: '',
  description: '',
  ingredients: '',
  allergens: '',
  storage: '',
  howToEnjoy: '',
  highlights: [],
};
const NEW = {
  slug: '',
  sku: '',
  range: 'foxnuts',
  accent: '#2f6b35',
  image: '',
  price: CATALOG_PRICES.foxnuts,
  vat: { DE: 7, GB: 20 },
  netWeightGrams: null,
  inStock: true,
  active: false,
  featured: true,
  isNew: true,
  bundleEligible: true,
  sortOrder: 100,
  i18n: { de: { ...emptyText }, en: { ...emptyText } },
  nutrition: null,
};

export default function ProductForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const action = useAction();
  const [form, setForm] = useState(isNew ? NEW : null);
  const [priceText, setPriceText] = useState(euroInput(NEW.price));
  const [tab, setTab] = useState('de');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    if (isNew) return;
    action.run(async () => {
      const { product } = await adminApi.product(id);
      setForm(product);
      setPriceText(euroInput(product.price));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!form) return action.error ? <ErrorNote message={action.error} /> : <p>Loading…</p>;

  const set = (patch) => {
    setSaved('');
    setForm((f) => ({ ...f, ...patch }));
  };
  const setText = (lang, key, value) =>
    set({ i18n: { ...form.i18n, [lang]: { ...form.i18n[lang], [key]: value } } });
  // Kept as typed text ("1," or "0.") while editing; converted on save.
  const setNutrient = (key, value) => set({ nutrition: { ...form.nutrition, [key]: value } });
  const toNumber = (v) => (v === '' || v === null ? NaN : Number(String(v).replace(',', '.')));
  const highlightsText = (lang) => {
    const h = form.i18n[lang].highlights;
    return Array.isArray(h) ? h.join('\n') : h;
  };
  const toHighlights = (h) =>
    (Array.isArray(h) ? h : String(h).split('\n'))
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 6);

  const upload = async (file) => {
    if (!file) return;
    const res = await action.run(() => adminApi.upload(file));
    if (res?.url) set({ image: res.url });
  };

  const submit = async (e) => {
    e.preventDefault();
    const price = parseEuro(priceText);
    if (!Number.isFinite(price) || price <= 0) return action.setError('Enter a valid price.');
    let nutrition = null;
    if (form.nutrition) {
      nutrition = Object.fromEntries(NUTRIENTS.map(([k]) => [k, toNumber(form.nutrition[k])]));
      if (!Object.values(nutrition).every((n) => Number.isFinite(n) && n >= 0))
        return action.setError(
          'Fill in every nutrition value (numbers like 1.2), or remove the table.',
        );
    }
    const { id: _id, version, archivedAt: _a, createdAt: _c, updatedAt: _u, ...rest } = form;
    const body = {
      ...rest,
      price,
      netWeightGrams: form.netWeightGrams ? Number(form.netWeightGrams) : null,
      bundleEligible: form.range === 'foxnuts' && form.bundleEligible,
      nutrition,
      i18n: {
        de: { ...form.i18n.de, highlights: toHighlights(form.i18n.de.highlights) },
        en: { ...form.i18n.en, highlights: toHighlights(form.i18n.en.highlights) },
      },
    };
    const res = await action.run(() =>
      isNew ? adminApi.createProduct(body) : adminApi.updateProduct(id, { ...body, version }),
    );
    if (!res?.product) return;
    setForm(res.product);
    setSaved('Saved. The shop shows the change within a minute.');
    if (isNew) navigate(`/admin/products/${res.product.id}`, { replace: true });
  };

  const gaps = complianceGaps(form);
  const t = form.i18n[tab];

  return (
    <form className="adm-product" onSubmit={submit}>
      <Link to="/admin/products" className="adm-back">
        <ArrowLeft size={16} aria-hidden="true" /> Products
      </Link>
      <PageHead title={isNew ? 'New product' : form.i18n.en.name}>
        <button className="adm-btn" type="submit" disabled={action.busy}>
          {action.busy ? 'Saving…' : 'Save'}
        </button>
      </PageHead>
      <ErrorNote message={action.error} />
      {saved && (
        <p className="adm-ok" role="status">
          {saved}
        </p>
      )}
      {gaps.length > 0 && (
        <p className="adm-warnbox">
          For selling food online in Germany and the UK, please add:{' '}
          <strong>{gaps.join(', ')}</strong>.
        </p>
      )}

      <div className="adm-product__grid">
        <section className="adm-card">
          <h2>Basics</h2>
          <div className="adm-form adm-form--2">
            <label>
              Range
              <select
                value={form.range}
                onChange={(e) => {
                  const range = e.target.value;
                  const patch = {
                    range,
                    bundleEligible: range === 'foxnuts' && form.bundleEligible,
                  };
                  // Apply a range default only to untouched new-product pricing.
                  // Existing products and deliberately entered prices remain authoritative.
                  if (isNew && parseEuro(priceText) === CATALOG_PRICES[form.range]) {
                    patch.price = CATALOG_PRICES[range];
                    setPriceText(euroInput(patch.price));
                  }
                  set(patch);
                }}
              >
                {Object.values(RANGES).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label.en}
                  </option>
                ))}
              </select>
            </label>
            <label>
              URL name {isNew ? '' : <small>(changing it breaks old links)</small>}
              <input
                value={form.slug}
                onChange={(e) =>
                  set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })
                }
                placeholder="mint-chutney"
                required
              />
            </label>
            <label>
              SKU (leave blank to generate)
              <input
                value={form.sku}
                onChange={(e) => set({ sku: e.target.value.toUpperCase() })}
                placeholder="Generated on save"
                required={!isNew}
              />
            </label>
            {isNew && (
              <button
                className="adm-btn adm-btn--ghost"
                type="button"
                onClick={async () => {
                  const r = await action.run(() => adminApi.generateSku(form.range));
                  if (r) set({ sku: r.sku });
                }}
              >
                Generate SKU now
              </button>
            )}
            <label>
              Price incl. VAT (€)
              <input
                inputMode="decimal"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                required
              />
            </label>
            <label>
              VAT Germany (%)
              <input
                type="number"
                min="0"
                max="30"
                step="0.1"
                value={form.vat.DE}
                onChange={(e) => set({ vat: { ...form.vat, DE: Number(e.target.value) } })}
              />
            </label>
            <label>
              VAT UK (%)
              <input
                type="number"
                min="0"
                max="30"
                step="0.1"
                value={form.vat.GB}
                onChange={(e) => set({ vat: { ...form.vat, GB: Number(e.target.value) } })}
              />
            </label>
            <label>
              Net weight (g)
              <input
                type="number"
                min="1"
                value={form.netWeightGrams ?? ''}
                onChange={(e) =>
                  set({ netWeightGrams: e.target.value ? Number(e.target.value) : null })
                }
              />
            </label>
            <label>
              Sort order <small>(lower shows first)</small>
              <input
                type="number"
                min="0"
                value={form.sortOrder}
                onChange={(e) => set({ sortOrder: Number(e.target.value) })}
              />
            </label>
            <label>
              Pack colour
              <input
                type="color"
                value={form.accent}
                onChange={(e) => set({ accent: e.target.value })}
              />
            </label>
          </div>
          <fieldset className="adm-flags">
            <legend>Visibility</legend>
            {[
              ['active', 'Shown in shop'],
              ['inStock', 'Available for sale (quantity is managed in Inventory)'],
              ['featured', 'Featured'],
              ['isNew', 'Show "New" sticker'],
              ...(form.range === 'foxnuts'
                ? [['bundleEligible', 'Can be chosen for 8/16 boxes']]
                : []),
            ].map(([key, label]) => (
              <label key={key} className="adm-check">
                <input
                  type="checkbox"
                  checked={Boolean(form[key])}
                  onChange={(e) => set({ [key]: e.target.checked })}
                />{' '}
                {label}
              </label>
            ))}
          </fieldset>
        </section>

        <section className="adm-card">
          <h2>Image</h2>
          <div className="adm-image" style={{ background: form.accent }}>
            {form.image ? <img src={form.image} alt="" /> : <span>No image yet</span>}
          </div>
          <label className="adm-btn adm-btn--ghost adm-upload">
            <Upload size={16} aria-hidden="true" /> Upload image
            <input
              type="file"
              accept="image/webp,image/png,image/jpeg"
              onChange={(e) => upload(e.target.files?.[0])}
            />
          </label>
          <p className="muted">WebP, PNG or JPEG up to 3 MB. Portrait 800 × 1100 px works best.</p>
        </section>

        <section className="adm-card adm-product__texts">
          <div className="adm-tabs" role="tablist">
            {['de', 'en'].map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={tab === l}
                className={tab === l ? 'is-on' : ''}
                onClick={() => setTab(l)}
              >
                {l === 'de' ? 'Deutsch' : 'English'}
              </button>
            ))}
          </div>
          <div className="adm-form">
            {TEXT_FIELDS.map(([key, label, as]) => (
              <label key={key}>
                {label}
                {as === 'textarea' ? (
                  <textarea
                    rows={3}
                    value={t[key]}
                    onChange={(e) => setText(tab, key, e.target.value)}
                    required={key === 'description'}
                  />
                ) : (
                  <input
                    value={t[key]}
                    onChange={(e) => setText(tab, key, e.target.value)}
                    required={key === 'name' || key === 'fullName'}
                  />
                )}
              </label>
            ))}
            <label>
              Highlights, one per line (max 6)
              <textarea
                rows={3}
                value={highlightsText(tab)}
                onChange={(e) => setText(tab, 'highlights', e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="adm-card">
          <h2>Nutrition per 100 g</h2>
          {form.nutrition ? (
            <>
              <div className="adm-form adm-form--3">
                {NUTRIENTS.map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      inputMode="decimal"
                      value={form.nutrition[key] ?? ''}
                      onChange={(e) => setNutrient(key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="adm-btn adm-btn--ghost"
                onClick={() => set({ nutrition: null })}
              >
                Remove table
              </button>
            </>
          ) : (
            <button
              type="button"
              className="adm-btn adm-btn--ghost"
              onClick={() =>
                set({ nutrition: Object.fromEntries(NUTRIENTS.map(([k]) => [k, ''])) })
              }
            >
              Add nutrition table
            </button>
          )}
        </section>
      </div>
    </form>
  );
}
