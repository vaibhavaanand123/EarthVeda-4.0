import { ArrowDown, ArrowRight, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { L, useI18n } from '../i18n/LanguageContext';
import { useStore } from '../context/StoreContext';
import { useCart } from '../context/CartContext';
import { availableQuantity } from '../../shared/catalog.js';
import ProductImage from './ProductImage';

export default function EditorialHero() {
  const { t, money, lang } = useI18n();
  const store = useStore();
  const cart = useCart();
  const [range, setRange] = useState('foxnuts');
  const [selected, setSelected] = useState({ foxnuts: 'peri-peri', protein: 'protein-mango' });
  const products = store.products.filter((p) => p.range === range);
  const product = products.find((p) => p.id === selected[range]) || products[0];
  if (!product) return null;
  const supporting = products.find((p) => p.id !== product.id);
  const protein = range === 'protein';
  const first = t(`refresh.hero.${protein ? 'proteinFirst' : 'first'}`);
  const second = t(`refresh.hero.${protein ? 'proteinSecond' : 'second'}`);
  const accent = t(`refresh.hero.${protein ? 'proteinAccent' : 'accent'}`);

  return (
    <section
      className={`editorial-hero editorial-hero--${range}`}
      aria-label="EarthVeda Essentials"
    >
      <div className="container editorial-hero__grid">
        <div className="editorial-hero__copy">
          <p className="eyebrow">
            <span className="tiny-sun" aria-hidden="true">
              ✳
            </span>{' '}
            {t('refresh.hero.eyebrow')}
          </p>
          <h1>
            <span>{first}</span>
            <span>
              {second} <em>{accent}</em>
            </span>
          </h1>
          <p className="editorial-hero__lede">{t('refresh.hero.description')}</p>
          <div className="hero-actions">
            <L className="btn btn--ink btn--lg" to="shop" query={{ range }}>
              {t('refresh.hero.shop')} <ArrowRight size={18} aria-hidden="true" />
            </L>
            <a href="#flavour-finder" className="hero-quiz-link">
              <Sparkles size={17} aria-hidden="true" /> {t('refresh.hero.quiz')}
            </a>
          </div>
          <div className="hero-proof">
            <span aria-hidden="true">01 / 02</span>
            <p>{t('refresh.hero.range')}</p>
          </div>
          <div className="range-switch" role="group" aria-label={t('refresh.hero.range')}>
            {['foxnuts', 'protein'].map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={range === id}
                className={range === id ? 'is-active' : ''}
                onClick={() => setRange(id)}
              >
                {t(`refresh.hero.${id === 'foxnuts' ? 'rangeFoxnuts' : 'rangeProtein'}`)}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
        <div className="hero-scene" style={{ '--scene-accent': product.accent }}>
          <p className="hero-scene__word" aria-hidden="true">
            {protein ? 'SIP.' : 'CRUNCH.'}
          </p>
          <div className="hero-scene__spark hero-scene__spark--one" aria-hidden="true">
            ✳
          </div>
          <div className="hero-scene__spark hero-scene__spark--two" aria-hidden="true">
            ✦
          </div>
          <div className="hero-scene__ground" aria-hidden="true" />
          {supporting && (
            <div className="hero-scene__pack hero-scene__pack--back" aria-hidden="true">
              <ProductImage product={supporting} eager alt="" />
            </div>
          )}
          <div className="hero-scene__pack hero-scene__pack--front" key={product.id}>
            <ProductImage product={product} eager />
          </div>
          <div className="hero-scene__price">
            <span>{t('refresh.hero.note')}</span>
            <strong>{money(product.price)}</strong>
            <span>
              {protein ? (lang === 'de' ? 'pro Stück' : 'per unit') : t('refresh.hero.perPack')}
            </span>
          </div>
          <div className="hero-scene__caption">
            <span className="eyebrow">{t(`refresh.hero.${protein ? 'protein' : 'foxnuts'}`)}</span>
            <strong>{product.name}</strong>
          </div>
          <div
            className="hero-flavours"
            role="group"
            aria-label={lang === 'de' ? 'Sorte auswählen' : 'Choose a flavour'}
          >
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.name}
                aria-label={p.name}
                aria-pressed={p.id === product.id}
                className={p.id === product.id ? 'is-on' : ''}
                style={{ '--swatch': p.accent }}
                onClick={() => setSelected((v) => ({ ...v, [range]: p.id }))}
              />
            ))}
            <button
              type="button"
              className="hero-flavours__add"
              onClick={() => cart.add(product)}
              aria-label={`${t('common.add')}: ${product.name}`}
              disabled={availableQuantity(product, cart.country) === 0}
            >
              <Plus size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      <div className="hero-bottom container">
        <span>
          {lang === 'de' ? 'DEIN ALLTAG. DEIN GESCHMACK.' : 'YOUR EVERYDAY. YOUR KIND OF FLAVOUR.'}
        </span>
        <a href="#discover">
          <ArrowDown size={14} aria-hidden="true" />{' '}
          {lang === 'de' ? 'Weiter entdecken' : 'A little more to discover'}
        </a>
      </div>
    </section>
  );
}
