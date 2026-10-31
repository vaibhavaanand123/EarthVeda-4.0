import { ArrowUpRight, Heart, Plus } from 'lucide-react';
import { availableQuantity } from '../../shared/catalog.js';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { L, useI18n } from '../i18n/LanguageContext';
import Price from './Price';
import ProductImage from './ProductImage';

/** Signature card: a vertical flavour band in the pack colour, like the pouches themselves. */
export default function ProductCard({ product, eager = false }) {
  const { t } = useI18n();
  const { add, country } = useCart();
  const wishlist = useWishlist();
  const wished = wishlist.has(product.id);
  const sellable = availableQuantity(product, country) > 0;
  const params = { slug: product.slug };
  return (
    <article className="card" style={{ '--accent': product.accent }}>
      <div className="card__main">
        <L to="product" params={params} className="card__media" tabIndex={-1} aria-hidden="true">
          <ProductImage product={product} eager={eager} alt="" />
        </L>
        {product.isNew && <span className="sticker">{t('common.new')}</span>}
        {!sellable && <span className="sticker sticker--muted">{t('common.soldOut')}</span>}
        <button
          type="button"
          className={`card__wish${wished ? ' is-on' : ''}`}
          onClick={() => wishlist.toggle(product.id)}
          aria-pressed={wished}
          aria-label={`${wished ? t('product.unwish') : t('product.wish')}: ${product.fullName}`}
        >
          <Heart size={18} fill={wished ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
        <div className="card__body">
          <p className="card__meta">
            {product.rangeLabel}
            {product.netWeightGrams ? ` · ${product.netWeightGrams} g` : ''}
          </p>
          <h3 className="card__title">
            <L to="product" params={params}>
              {product.name}
            </L>
          </h3>
          <div className="card__foot">
            <Price product={product} showUnit />
            <button
              type="button"
              className="btn btn--add"
              onClick={() => add(product)}
              disabled={!sellable}
              aria-label={
                sellable
                  ? `${t('common.add')}: ${product.fullName}`
                  : `${product.fullName}: ${t('common.soldOut')}`
              }
            >
              <Plus size={17} aria-hidden="true" /> <span>{t('common.addShort')}</span>
            </button>
          </div>
          <L to="product" params={params} className="card__details">
            {t('common.details')} <ArrowUpRight size={14} aria-hidden="true" />
          </L>
        </div>
      </div>
    </article>
  );
}
