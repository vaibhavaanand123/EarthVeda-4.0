import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { L, useI18n } from '../i18n/LanguageContext';
import ProductGrid from './ProductGrid';

export default function DiscoverySection() {
  const { t } = useI18n();
  const store = useStore();
  const [range, setRange] = useState('foxnuts');
  const products = range === 'foxnuts' ? store.foxnuts : store.protein;
  return (
    <section
      id="discover"
      className="discovery section container"
      aria-labelledby="discovery-title"
    >
      <div className="discovery__heading">
        <div>
          <p className="eyebrow">{t('refresh.products.eyebrow')}</p>
          <h2 id="discovery-title" className="display-heading">
            {t('refresh.products.title')}
          </h2>
        </div>
        <p>{t('refresh.products.description')}</p>
      </div>
      <div className="discovery__toolbar">
        <div className="discovery-tabs" role="group" aria-label={t('shop.title')}>
          {['foxnuts', 'protein'].map((id) => (
            <button
              type="button"
              key={id}
              className={range === id ? 'is-on' : ''}
              aria-pressed={range === id}
              onClick={() => setRange(id)}
            >
              {t(`refresh.products.${id}`)}{' '}
              <span>{id === 'foxnuts' ? store.foxnuts.length : store.protein.length}</span>
            </button>
          ))}
        </div>
        <L to="shop" query={{ range }} className="link link--arrow">
          {t('refresh.products.all')}
          <ArrowRight size={16} aria-hidden="true" />
        </L>
      </div>
      <ProductGrid
        products={products.slice(0, 4)}
        eagerCount={0}
        label={t(`refresh.products.${range}`)}
      />
      <p className="discovery__note">
        {t('refresh.products.tax')} ·{' '}
        {t('refresh.products.count', { count: store.products.length })}
      </p>
    </section>
  );
}
