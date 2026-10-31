import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { flavourName } from '../../shared/catalog.js';
import { useCart } from '../context/CartContext';
import { L, useI18n } from '../i18n/LanguageContext';
import Price from './Price';
import ProductImage from './ProductImage';

const ROTATE_MS = 7000;
const RANGES = ['foxnuts', 'protein'];

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Hero: one slide per range, each with a flavour picker that floods the hero
 * with that pack's colour. Both ranges share the same rounded product window.
 * Auto-advance pauses on hover, focus, hidden tab and reduced motion.
 */
export default function HeroSlider({ products }) {
  const { t, lang } = useI18n();
  const slides = RANGES.map((range) => ({
    range,
    copy: t(`hero.${range}`),
    products: products.filter((p) => p.range === range),
  })).filter((s) => s.products.length);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState({});
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [held, setHeld] = useState(false);
  const [hidden, setHidden] = useState(false);
  const touch = useRef(null);
  const { add } = useCart();

  const count = slides.length;
  const go = useCallback((next) => setIndex((next + count) % count), [count]);
  const running = playing && !held && !hidden && count > 1;

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    const id = setTimeout(() => go(index + 1), ROTATE_MS);
    return () => clearTimeout(id);
  }, [running, index, go]);

  if (!count) return null;
  const slide = slides[Math.min(index, count - 1)];
  const active = slide.products.find((p) => p.id === picked[slide.range]) || slide.products[0];
  const short = (p) => flavourName(p, lang);

  const onKeyDown = (e) => {
    if (e.target.closest('input')) return; // radios use arrows for flavours
    if (e.key === 'ArrowRight') go(index + 1);
    if (e.key === 'ArrowLeft') go(index - 1);
  };
  const onTouchStart = (e) => (touch.current = e.touches[0].clientX);
  const onTouchEnd = (e) => {
    if (touch.current === null) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    touch.current = null;
    if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
  };
  const [lastLine, ...firstLines] = [...slide.copy.title].reverse();

  return (
    <section
      className={`hero hero--${slide.range}`}
      style={{ '--accent': active.accent }}
      aria-roledescription="carousel"
      aria-label={t('hero.region')}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={(e) => e.target.matches(':focus-visible') && setHeld(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHeld(false)}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="container hero__grid"
        key={slide.range}
        role="group"
        aria-roledescription="slide"
        aria-label={t('hero.slide', { index: index + 1, count, name: slide.copy.tab })}
        aria-live={running ? 'off' : 'polite'}
      >
        <div className="hero__copy">
          <p className="hero__eyebrow">{slide.copy.eyebrow}</p>
          <h1 className="hero__title">
            {firstLines.reverse().map((line) => (
              <span className="hero__line" key={line}>
                {line}
              </span>
            ))}
            <span className="hero__line hero__line--hl">{lastLine}</span>
          </h1>
          <p className="hero__lede">{slide.copy.lede}</p>

          <fieldset className="swatches">
            <legend>{t('hero.pickFlavour')}</legend>
            <div className="swatches__row">
              {slide.products.map((p) => (
                <label key={p.id} className="swatch" style={{ '--swatch': p.accent }}>
                  <input
                    type="radio"
                    name={`hero-${slide.range}`}
                    value={p.id}
                    checked={p.id === active.id}
                    onChange={() => setPicked((s) => ({ ...s, [slide.range]: p.id }))}
                  />
                  <span className="swatch__dot" aria-hidden="true" />
                  <span className="swatch__name">{short(p)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <p className="hero__flavour" aria-live="polite">
            {active.description}
          </p>

          <div className="hero__actions">
            <button
              type="button"
              className="btn btn--light"
              onClick={() => add(active)}
              disabled={!active.inStock}
            >
              {active.inStock ? t('hero.addFlavour', { name: short(active) }) : t('common.soldOut')}{' '}
              · <Price product={active} />
            </button>
            <L className="btn btn--ghost-light" to="product" params={{ slug: active.slug }}>
              {t('common.details')} <ArrowRight size={18} aria-hidden="true" />
            </L>
          </div>
        </div>

        <div className="hero__stage" aria-hidden="true">
          <div className={`hero__window hero__window--${slide.range}`}>
            <ProductImage key={active.id} product={active} eager alt="" />
          </div>
          <div className="hero__stamp">
            <span>{slide.copy.stamp[0]}</span>
            <strong>{slide.copy.stamp[1]}</strong>
          </div>
        </div>
      </div>

      {count > 1 && (
        <div className="container hero__controls">
          <div className="hero__tabs" role="group" aria-label={t('hero.chooseSlide')}>
            {slides.map((s, i) => (
              <button
                key={s.range}
                type="button"
                className={`hero__tab${i === index ? ' is-on' : ''}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => go(i)}
              >
                <span className="hero__tab-label">{s.copy.tab}</span>
                <span className="hero__tab-bar" aria-hidden="true">
                  <span
                    key={`${index}-${running}`}
                    className={i === index && running ? 'is-running' : i === index ? 'is-full' : ''}
                    style={{ animationDuration: `${ROTATE_MS}ms` }}
                  />
                </span>
              </button>
            ))}
          </div>
          <div className="hero__buttons">
            <button
              type="button"
              className="hero__btn"
              onClick={() => setPlaying((v) => !v)}
              aria-label={playing ? t('hero.pause') : t('hero.play')}
            >
              {playing ? (
                <Pause size={16} aria-hidden="true" />
              ) : (
                <Play size={16} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              className="hero__btn"
              onClick={() => go(index - 1)}
              aria-label={t('hero.prev')}
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="hero__btn"
              onClick={() => go(index + 1)}
              aria-label={t('hero.next')}
            >
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
