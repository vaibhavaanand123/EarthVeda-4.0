import { X } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RANGES } from '../../shared/catalog.js';
import EmptyState from '../components/EmptyState';
import ProductGrid from '../components/ProductGrid';
import Seo from '../components/Seo';
import { useStore } from '../context/StoreContext';
import { L, useI18n } from '../i18n/LanguageContext';
import StoreStatus from './StoreStatus';

const SORTS = ['featured', 'price-asc', 'price-desc', 'name'];
const SORT_KEYS = {
  featured: 'shop.sortFeatured',
  'price-asc': 'shop.sortPriceAsc',
  'price-desc': 'shop.sortPriceDesc',
  name: 'shop.sortName',
};

export default function Shop() {
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const store = useStore();
  const range = Object.hasOwn(RANGES, params.get('range')) ? params.get('range') : 'all';
  const sort = SORTS.includes(params.get('sort')) ? params.get('sort') : 'featured';
  const query = (params.get('q') || '').trim().slice(0, 60);

  const visible = useMemo(() => {
    const q = query.toLowerCase();
    const list = store.products.filter(
      (p) =>
        (range === 'all' || p.range === range) &&
        (!q || `${p.fullName} ${p.rangeLabel} ${p.description}`.toLowerCase().includes(q)),
    );
    return [...list].sort((a, b) => {
      if (sort === 'price-asc') return a.price - b.price;
      if (sort === 'price-desc') return b.price - a.price;
      if (sort === 'name') return a.name.localeCompare(b.name, lang);
      return Number(b.inStock) - Number(a.inStock) || a.sortOrder - b.sortOrder;
    });
  }, [store.products, range, sort, query, lang]);

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'all' || (key === 'sort' && value === 'featured')) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  if (store.loading || store.error) return <StoreStatus />;

  const heading = query
    ? t('shop.searchFor', { q: query })
    : range === 'foxnuts'
      ? t('shop.foxnutsTitle')
      : range === 'protein'
        ? t('shop.proteinTitle')
        : t('shop.title');
  const lede = range === 'protein' ? t('home.proteinLede') : t('home.foxnutsLede');

  return (
    <main className="page container">
      <Seo title={heading} description={lede} />
      <header className="page-head">
        <p className="eyebrow">Shop</p>
        <h1>{heading}</h1>
        <p>{lede}</p>
      </header>

      <div className="toolbar">
        <div className="tabs" role="group" aria-label="Range">
          {[['all', t('shop.all')], ...Object.values(RANGES).map((r) => [r.id, r.label[lang]])].map(
            ([id, label]) => (
              <button
                key={id}
                type="button"
                className={range === id ? 'is-on' : ''}
                aria-pressed={range === id}
                onClick={() => update('range', id)}
              >
                {label}
              </button>
            ),
          )}
        </div>
        <label className="select">
          <span>{t('shop.sort')}</span>
          <select value={sort} onChange={(e) => update('sort', e.target.value)}>
            {SORTS.map((id) => (
              <option key={id} value={id}>
                {t(SORT_KEYS[id])}
              </option>
            ))}
          </select>
        </label>
      </div>
      {(query || range !== 'all') && (
        <div className="chips">
          <button
            type="button"
            className="chip chip--clear"
            onClick={() => setParams({}, { replace: true })}
          >
            <X size={14} aria-hidden="true" /> {t('shop.clear')}
          </button>
        </div>
      )}

      {range !== 'protein' && !query && (
        <L to="box" className="promo-band">
          <span className="promo-band__tray" aria-hidden="true">
            {store.foxnuts.slice(0, 8).map((p) => (
              <span key={p.id} style={{ background: p.accent }} />
            ))}
          </span>
          <span>
            <strong>{t('nav.box')}</strong> {t('cart.upsellBox')}
          </span>
        </L>
      )}

      <p className="results" role="status">
        {t('shop.results', { count: visible.length })}
      </p>
      {visible.length ? (
        <ProductGrid products={visible} eagerCount={4} label={heading} />
      ) : (
        <EmptyState title={t('shop.empty')} action={t('shop.clear')} to="shop" />
      )}
    </main>
  );
}
