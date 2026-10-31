import { Package, Trash2 } from 'lucide-react';
import { ORDER_LIMITS } from '../../shared/pricing.js';
import { useCart } from '../context/CartContext';
import { L, useI18n } from '../i18n/LanguageContext';
import ProductImage from './ProductImage';
import QuantityControl from './QuantityControl';

const ISSUE_KEYS = { soldOut: 'cart.issueSoldOut', gone: 'cart.issueGone', box: 'cart.issueBox' };

function BoxTiles({ picks }) {
  return (
    <span className="line__box" aria-hidden="true">
      {picks.flatMap((p) =>
        Array.from({ length: p.quantity }, (_, i) => (
          <span key={`${p.productId}-${i}`} style={{ background: p.product?.accent || '#999' }} />
        )),
      )}
    </span>
  );
}

export default function CartLines({ compact = false }) {
  const { t, money, lang } = useI18n();
  const { lines, setQuantity, setBoxQuantity, remove } = useCart();
  return (
    <ul className={`lines${compact ? ' lines--compact' : ''}`}>
      {lines.map((line) => {
        const isBox = line.kind === 'box';
        const name = isBox
          ? line.bundle?.name?.[lang] || t('cart.box')
          : line.product?.name ||
            (lang === 'de' ? 'Nicht verfügbares Produkt' : 'Unavailable product');
        return (
          <li
            key={line.key}
            className={`line${isBox ? ' line--box' : ''}`}
            style={{ '--accent': isBox ? '#12372a' : line.product?.accent || '#53665a' }}
          >
            {isBox ? (
              <span className="line__img line__img--box">
                <Package size={26} aria-hidden="true" />
                <BoxTiles picks={line.picks} />
              </span>
            ) : line.product ? (
              <L
                to="product"
                params={{ slug: line.product.slug }}
                className="line__img"
                tabIndex={-1}
                aria-hidden="true"
              >
                <ProductImage product={line.product} alt="" />
              </L>
            ) : (
              <span className="line__img">
                <Package size={24} aria-hidden="true" />
              </span>
            )}
            <div className="line__info">
              {isBox ? (
                <span className="line__name">{name}</span>
              ) : line.product ? (
                <L to="product" params={{ slug: line.product.slug }} className="line__name">
                  {name}
                </L>
              ) : (
                <span className="line__name">{name}</span>
              )}
              <span className="line__meta">
                {isBox
                  ? line.picks
                      .map((p) => `${p.quantity}× ${p.product?.i18n?.[lang]?.name ?? p.productId}`)
                      .join(', ')
                  : line.product?.rangeLabel}
              </span>
              {!line.issue && line.product?.range === 'protein' && (
                <span className="line__meta">
                  {money(line.product.price)} {lang === 'de' ? 'pro Stück' : 'per unit'}
                </span>
              )}
              {line.issue && (
                <span className="line__issue" role="status">
                  {line.issue === 'stockLimit'
                    ? lang === 'de'
                      ? 'Bitte reduziere die Menge. Für dein Lieferland ist nicht genügend Bestand verfügbar.'
                      : 'Please reduce the quantity. There is not enough stock for your delivery country.'
                    : t(ISSUE_KEYS[line.issue])}
                </span>
              )}
              <div className="line__controls">
                <QuantityControl
                  value={line.quantity}
                  max={isBox ? ORDER_LIMITS.maxBoxQuantity : ORDER_LIMITS.maxQuantityPerLine}
                  onChange={(q) => (isBox ? setBoxQuantity(line.key, q) : setQuantity(line.id, q))}
                  label={t('cart.qtyLabel', { name })}
                  size="sm"
                />
                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  onClick={() => remove(line)}
                  aria-label={`${t('common.remove')}: ${name}`}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
            <strong className="line__total">{line.issue ? '' : money(line.lineTotal)}</strong>
          </li>
        );
      })}
    </ul>
  );
}
