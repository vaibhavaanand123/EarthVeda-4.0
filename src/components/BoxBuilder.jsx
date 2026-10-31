import { ArrowLeft, Flame, Minus, Plus, RotateCcw, ShoppingBag, Sparkles } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { flavourName } from '../../shared/catalog.js';
import { useCart } from '../context/CartContext';
import { useStore } from '../context/StoreContext';
import { useI18n } from '../i18n/LanguageContext';
import {
  PACK_STEP,
  addPair,
  filled,
  fitToSize,
  rankFlavours,
  removePair,
  suggestBox,
  toPicks,
} from '../lib/flavourFinder';
import ProductImage from './ProductImage';

const SPICE = [
  { value: 0, key: 'quiz.spiceMild', heat: 1 },
  { value: 1, key: 'quiz.spiceMedium', heat: 2 },
  { value: 2, key: 'quiz.spiceHot', heat: 3 },
];
const TASTE = [
  { value: 'cheese', key: 'quiz.tasteCheese' },
  { value: 'savoury', key: 'quiz.tasteSavoury' },
  { value: 'classic', key: 'quiz.tasteClassic' },
  { value: 'surprise', key: 'quiz.tasteSurprise' },
];

function Choice({ name, options, value, onPick, render }) {
  return (
    <div className="quiz__choices" role="group" aria-labelledby={`${name}-q`}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={value === o.value}
          className={`quiz__choice${value === o.value ? ' is-on' : ''}`}
          onClick={() => onPick(o.value)}
        >
          {render(o)}
        </button>
      ))}
    </div>
  );
}

/**
 * The box tray: one slot per pack, filled in pouch colours as flavours are
 * picked. This is the visual signature of the store.
 */
function Tray({ size, picks, productsById, lang }) {
  const slots = Object.entries(picks).flatMap(([id, q]) =>
    Array.from({ length: q }, () => productsById.get(id)),
  );
  return (
    <div className={`tray tray--${size}`} aria-hidden="true">
      {Array.from({ length: size }, (_, i) => {
        const p = slots[i];
        return (
          <span
            key={i}
            className={`tray__slot${p ? ' is-filled' : ''}`}
            style={p ? { '--accent': p.accent } : undefined}
          >
            {p && <span className="tray__label">{flavourName(p, lang)}</span>}
          </span>
        );
      })}
    </div>
  );
}

/**
 * "Choose your flavours": a three-question flavour finder that builds an 8 or
 * 16 pack box with two packs of each flavour, then lets the shopper tweak it
 * and add the whole box to the bag in one tap.
 */
export default function BoxBuilder({ headingLevel = 2 }) {
  const { t, money, lang } = useI18n();
  const store = useStore();
  const cart = useCart();
  const titleId = useId();
  const H = `h${headingLevel}`;

  const flavours = useMemo(
    () => store.foxnuts.filter((p) => p.bundleEligible && p.inStock && p.active),
    [store.foxnuts],
  );
  const productsById = useMemo(() => new Map(flavours.map((p) => [p.id, p])), [flavours]);
  const bundles = [...store.bundles].sort((a, b) => a.size - b.size);

  const [step, setStep] = useState(0); // 0 intro, 1 size, 2 spice, 3 taste, 4 build
  const [bundleId, setBundleId] = useState(null);
  const [spice, setSpice] = useState(null);
  const [taste, setTaste] = useState(null);
  const [picks, setPicks] = useState({});
  const [seed, setSeed] = useState(1);
  const questionRef = useRef(null);
  useEffect(() => {
    if (step > 0) questionRef.current?.focus();
  }, [step]);

  if (!bundles.length || flavours.length === 0)
    return (
      <section className="quiz" aria-labelledby={titleId}>
        <H id={titleId}>{t('quiz.title')}</H>
        <p>{t('quiz.unavailable')}</p>
      </section>
    );

  const bundle = bundles.find((b) => b.id === bundleId) ?? bundles[0];
  const size = bundle.size;
  const count = filled(picks);
  const left = size - count;
  const total = 3;

  const finish = (nextTaste) => {
    setTaste(nextTaste);
    const s = seed + 1;
    setSeed(s);
    setPicks(suggestBox(rankFlavours(flavours, { spice: spice ?? 1, taste: nextTaste }, s), size));
    setStep(4);
  };
  const chooseSize = (id) => {
    setBundleId(id);
    const b = bundles.find((x) => x.id === id);
    setPicks((p) => fitToSize(p, b.size));
    setStep(2);
  };
  const restart = () => {
    setStep(1);
    setPicks({});
    setSpice(null);
    setTaste(null);
  };
  const addToBag = () => {
    cart.addBox(bundle.id, toPicks(picks), { openDrawer: false });
    cart.notify(t('quiz.added'));
    cart.openDrawer();
  };

  return (
    <section className="quiz" aria-labelledby={titleId} id="flavour-finder">
      <div className="quiz__head">
        <p className="eyebrow">
          <Sparkles size={14} aria-hidden="true" /> {t('quiz.eyebrow')}
        </p>
        <H id={titleId} className="quiz__title">
          {t('quiz.title')}
        </H>
        {step === 0 && <p className="quiz__lede">{t('quiz.lede')}</p>}
      </div>

      {step === 0 && (
        <div className="quiz__intro">
          <div className="quiz__packs" aria-hidden="true">
            {flavours.slice(0, 4).map((p) => (
              <span key={p.id} className="quiz__pack" style={{ '--accent': p.accent }}>
                <ProductImage product={p} alt="" />
              </span>
            ))}
          </div>
          <div className="quiz__cta">
            <button type="button" className="btn btn--ink btn--lg" onClick={() => setStep(1)}>
              {t('quiz.start')}
            </button>
            <button
              type="button"
              className="link"
              onClick={() => {
                setBundleId(bundles[0].id);
                setStep(4);
              }}
            >
              {t('quiz.skip')}
            </button>
          </div>
        </div>
      )}

      {step >= 1 && step <= 3 && (
        <div className="quiz__step" key={step}>
          <div className="quiz__progress">
            <span>{t('quiz.step', { step, total })}</span>
            <span className="quiz__bar" aria-hidden="true">
              <span style={{ width: `${(step / total) * 100}%` }} />
            </span>
          </div>
          {step === 1 && (
            <>
              <h3 id="size-q" className="quiz__q" ref={questionRef} tabIndex={-1}>
                {t('quiz.sizeQ')}
              </h3>
              <Choice
                name="size"
                options={bundles.map((b) => ({ value: b.id, bundle: b }))}
                value={bundleId}
                onPick={chooseSize}
                render={({ bundle: b }) => (
                  <>
                    <strong>
                      {b.size === 8
                        ? t('quiz.size8')
                        : b.size === 16
                          ? t('quiz.size16')
                          : b.name[lang]}
                    </strong>
                    <span>
                      {b.size === 8
                        ? t('quiz.size8Note')
                        : b.size === 16
                          ? t('quiz.size16Note')
                          : ''}
                    </span>
                    <em>{money(b.price)}</em>
                  </>
                )}
              />
            </>
          )}
          {step === 2 && (
            <>
              <h3 id="spice-q" className="quiz__q" ref={questionRef} tabIndex={-1}>
                {t('quiz.spiceQ')}
              </h3>
              <Choice
                name="spice"
                options={SPICE}
                value={spice}
                onPick={(v) => {
                  setSpice(v);
                  setStep(3);
                }}
                render={(o) => (
                  <>
                    <span className="quiz__heat" aria-hidden="true">
                      {Array.from({ length: o.heat }, (_, i) => (
                        <Flame key={i} size={18} />
                      ))}
                    </span>
                    <strong>{t(o.key)}</strong>
                  </>
                )}
              />
            </>
          )}
          {step === 3 && (
            <>
              <h3 id="taste-q" className="quiz__q" ref={questionRef} tabIndex={-1}>
                {t('quiz.tasteQ')}
              </h3>
              <Choice
                name="taste"
                options={TASTE}
                value={taste}
                onPick={finish}
                render={(o) => <strong>{t(o.key)}</strong>}
              />
            </>
          )}
          <button type="button" className="link quiz__back" onClick={() => setStep(step - 1)}>
            <ArrowLeft size={16} aria-hidden="true" /> {t('common.back')}
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="builder">
          <div className="builder__top">
            <div>
              <h3 className="quiz__q" ref={questionRef} tabIndex={-1}>
                {t('quiz.resultTitle', { size })}
              </h3>
              <p className="muted">{t('quiz.resultLede')}</p>
            </div>
            <div className="builder__sizes" role="group" aria-label={t('quiz.sizeQ')}>
              {bundles.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={b.id === bundle.id}
                  className={`chip${b.id === bundle.id ? ' is-on' : ''}`}
                  onClick={() => {
                    setBundleId(b.id);
                    setPicks((p) => fitToSize(p, b.size));
                  }}
                >
                  {b.size} · {money(b.price)}
                </button>
              ))}
            </div>
          </div>

          <Tray size={size} picks={picks} productsById={productsById} lang={lang} />
          <p className="builder__status" role="status">
            <strong>{t('quiz.progress', { filled: count, size })}</strong> ·{' '}
            {left > 0 ? t('quiz.fillUp', { left }) : t('quiz.full')}
          </p>

          <ul className="builder__grid">
            {flavours.map((p) => {
              const q = picks[p.id] || 0;
              const name = flavourName(p, lang);
              return (
                <li
                  key={p.id}
                  className={`flavour${q ? ' is-on' : ''}`}
                  style={{ '--accent': p.accent }}
                >
                  <button
                    type="button"
                    className="flavour__main"
                    onClick={() => setPicks((s) => addPair(s, p.id, size))}
                    disabled={left < PACK_STEP}
                    aria-label={t('quiz.addTwo', { name })}
                  >
                    <span className="flavour__img">
                      <ProductImage product={p} alt="" />
                    </span>
                    <span className="flavour__name">{name}</span>
                    {q > 0 && (
                      <span className="flavour__count">{t('quiz.inBox', { count: q })}</span>
                    )}
                  </button>
                  <div className="flavour__ctl">
                    <button
                      type="button"
                      onClick={() => setPicks((s) => removePair(s, p.id))}
                      disabled={!q}
                      aria-label={t('quiz.removeTwo', { name })}
                    >
                      <Minus size={16} aria-hidden="true" />
                    </button>
                    <output aria-hidden="true">{q}</output>
                    <button
                      type="button"
                      onClick={() => setPicks((s) => addPair(s, p.id, size))}
                      disabled={left < PACK_STEP}
                      aria-label={t('quiz.addTwo', { name })}
                    >
                      <Plus size={16} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="builder__foot">
            <button
              type="button"
              className="btn btn--ink btn--lg"
              disabled={left !== 0}
              onClick={addToBag}
            >
              <ShoppingBag size={18} aria-hidden="true" />{' '}
              {t('quiz.addBox', { price: money(bundle.price) })}
            </button>
            <span className="muted">
              {t('quiz.perPack', { price: money(Math.round(bundle.price / size)) })}
            </span>
            <button type="button" className="link" onClick={restart}>
              <RotateCcw size={14} aria-hidden="true" /> {t('quiz.restart')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
