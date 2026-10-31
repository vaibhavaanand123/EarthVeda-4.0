import { Heart, Package, ShoppingBag, Truck } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { availableQuantity, flavourName } from '../../shared/catalog.js';
import { ORDER_LIMITS } from '../../shared/pricing.js';
import EmptyState from '../components/EmptyState';
import Price from '../components/Price';
import ProductGrid from '../components/ProductGrid';
import ProductImage from '../components/ProductImage';
import QuantityControl from '../components/QuantityControl';
import Seo from '../components/Seo';
import { useCart } from '../context/CartContext';
import { useStore } from '../context/StoreContext';
import { useWishlist } from '../context/WishlistContext';
import { L, useI18n } from '../i18n/LanguageContext';
import StoreStatus from './StoreStatus';

const NUTRIENTS = [
  ['energy', (n) => `${n.energyKj} kJ / ${n.energyKcal} kcal`],
  ['fat', (n) => `${n.fat} g`],
  ['saturates', (n) => `${n.saturates} g`, true],
  ['carbs', (n) => `${n.carbs} g`],
  ['sugars', (n) => `${n.sugars} g`, true],
  ['fibre', (n) => `${n.fibre} g`],
  ['protein', (n) => `${n.protein} g`],
  ['salt', (n) => `${n.salt} g`],
];

/** EU 1169/2011 food information shown before purchase. */
function FoodInfo({ product, business }) {
  const { t, lang } = useI18n();
  const fmt = (v) => String(v).replace('.', lang === 'de' ? ',' : '.');
  const n = product.nutrition;
  const pending = !product.ingredients || !n;
  return (
    <div className="accordion">
      <details open>
        <summary>{t('product.howToEnjoy')}</summary>
        <p>{product.howToEnjoy}</p>
      </details>
      <details open={!pending}>
        <summary>
          {t('product.ingredients')} · {t('product.allergens')} · {t('product.nutrition')}
        </summary>
        {pending && <p className="notice">{t('product.infoPending')}</p>}
        {product.ingredients && (
          <p>
            <strong>{t('product.ingredients')}:</strong> {product.ingredients}
          </p>
        )}
        {product.allergens && (
          <p>
            <strong>{t('product.allergens')}:</strong> {product.allergens}
          </p>
        )}
        {n && (
          <table className="nutrition">
            <caption>{t('product.nutrition')}</caption>
            <tbody>
              {NUTRIENTS.map(([key, value, sub]) => (
                <tr key={key} className={sub ? 'is-sub' : undefined}>
                  <th scope="row">{t(`product.nutrients.${key}`)}</th>
                  <td>{fmt(value(n))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {product.netWeightGrams && (
          <p>
            <strong>{t('product.netWeight')}:</strong> {product.netWeightGrams} g
          </p>
        )}
        {product.storage && (
          <p>
            <strong>{t('product.storage')}:</strong> {product.storage}
          </p>
        )}
        {business.foodBusinessOperator && (
          <p>
            <strong>{t('product.operator')}:</strong> {business.foodBusinessOperator}
          </p>
        )}
      </details>
    </div>
  );
}

export default function Product() {
  const { slug } = useParams();
  return <ProductDetails key={slug} slug={slug} />;
}

function ProductDetails({ slug }) {
  const { t, money, lang } = useI18n();
  const store = useStore();
  const cart = useCart();
  const wishlist = useWishlist();
  const [quantity, setQuantity] = useState(1);

  if (store.loading || store.error) return <StoreStatus />;
  const product = store.bySlug(slug);
  if (!product)
    return (
      <main className="page container">
        <Seo title={t('notFound.title')} noindex />
        <EmptyState title={t('product.notFound')} action={t('notFound.cta')} to="shop" />
      </main>
    );

  const wished = wishlist.has(product.id);
  const max = Math.min(ORDER_LIMITS.maxQuantityPerLine, availableQuantity(product, cart.country));
  const sellable = max > 0;
  const amount = Math.min(quantity, max || 1);
  const related = store.products
    .filter((p) => p.range === product.range && p.id !== product.id)
    .slice(0, 4);
  const box8 = store.bundles.find((b) => b.size === 8);
  const eta = store.shipping[cart.country]?.eta?.[lang];
  const addToCart = () => cart.add(product, amount);

  return (
    <main className="page container" style={{ '--accent': product.accent }}>
      <Seo title={product.fullName} description={product.description} product={product} />
      <nav className="crumbs" aria-label="Breadcrumb">
        <L to="shop">{t('product.breadcrumbShop')}</L>
        <span aria-hidden="true">/</span>
        <L to="shop" query={{ range: product.range }}>
          {product.rangeLabel}
        </L>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{flavourName(product, lang)}</span>
      </nav>

      <div className="pdp">
        <div className="pdp__media">
          <div className="pdp__band" aria-hidden="true">
            <span>{flavourName(product, lang)}</span>
          </div>
          <div className={`pdp__img pdp__img--${product.range}`}>
            <ProductImage product={product} eager />
          </div>
        </div>

        <div className="pdp__info">
          <p className="eyebrow">
            {product.rangeLabel}
            {product.isNew && <span className="sticker sticker--inline">{t('common.new')}</span>}
          </p>
          <h1>{product.fullName}</h1>
          <Price product={product} showUnit showVat className="price--lg" />
          <p className="pdp__desc">{product.description}</p>

          {product.highlights.length > 0 && (
            <ul className="pdp__highlights" aria-label={t('product.highlights')}>
              {product.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}

          {!sellable && <p className="notice">{t('common.soldOut')}</p>}

          <div className="pdp__buy">
            {sellable && (
              <QuantityControl
                value={amount}
                onChange={setQuantity}
                max={max}
                label={t('product.quantity')}
              />
            )}
            <button
              type="button"
              className="btn btn--ink btn--grow btn--lg"
              onClick={addToCart}
              disabled={!sellable}
            >
              <ShoppingBag size={18} aria-hidden="true" /> {t('common.add')}
              {sellable && (
                <>
                  {' · '}
                  {money(product.price * amount)}
                </>
              )}
            </button>
            <button
              type="button"
              className={`icon-btn icon-btn--outline${wished ? ' is-on' : ''}`}
              onClick={() => wishlist.toggle(product.id)}
              aria-pressed={wished}
              aria-label={wished ? t('product.unwish') : t('product.wish')}
            >
              <Heart fill={wished ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
          </div>

          {product.bundleEligible && box8 && (
            <L to="box" className="pdp__boxpromo">
              <Package size={20} aria-hidden="true" />
              <span>
                {t('product.boxPromo', { price: money(Math.round(box8.price / box8.size)) })}{' '}
                <strong>{t('product.boxPromoCta')}</strong>
              </span>
            </L>
          )}

          {eta && (
            <div className="pdp__promise">
              <Truck size={18} aria-hidden="true" />
              <p>
                {t('product.shipsIn', { eta })}. <L to="shipping">{t('footer.shipping')}</L>
              </p>
            </div>
          )}

          <FoodInfo product={product} business={store.business} />
        </div>
      </div>

      {sellable && (
        <div className="sticky-buy only-mobile" role="region" aria-label={t('common.add')}>
          <div>
            <strong>{flavourName(product, lang)}</strong>
            <Price product={product} quantity={amount} />
          </div>
          <button type="button" className="btn btn--ink" onClick={addToCart}>
            {t('common.add')} · {money(product.price * amount)}
          </button>
        </div>
      )}

      {related.length > 0 && (
        <section className="section" aria-labelledby="related-title">
          <div className="section-head">
            <div>
              <h2 id="related-title">{t('product.related')}</h2>
            </div>
          </div>
          <ProductGrid products={related} label={t('product.related')} />
        </section>
      )}
    </main>
  );
}
