import { ArrowRight, Coffee, Package, Play, Sparkles, Truck } from 'lucide-react';
import BoxBuilder from '../components/BoxBuilder';
import DiscoverySection from '../components/DiscoverySection';
import EditorialHero from '../components/EditorialHero';
import ProductImage from '../components/ProductImage';
import Seo from '../components/Seo';
import { useStore } from '../context/StoreContext';
import { L, useI18n } from '../i18n/LanguageContext';
import StoreStatus from './StoreStatus';

export default function Home() {
  const { t, lang, money } = useI18n();
  const store = useStore();
  if (store.loading || store.error) return <StoreStatus />;
  const snack = store.foxnuts.find((p) => p.id === 'cream-onion') || store.foxnuts[0];
  const shake = store.protein[0];
  const faqs =
    lang === 'de'
      ? [
          [
            'Was sind Foxnuts?',
            'Foxnuts, auch Makhana genannt, sind gepoppte Seerosensamen. Unsere Sorten reichen von cremigen Klassikern bis zu würzigem Peri Peri. Prüfe vor dem Verzehr immer die Zutaten und Allergene der jeweiligen Sorte.',
          ],
          [
            'Kann ich mein eigenes Paket zusammenstellen?',
            'Ja. Unser Quiz empfiehlt passende Sorten und fügt sie paarweise hinzu. Du kannst deinen Mix anschließend ändern. Das 8er-Paket kostet 23,92 €, das 16er-Paket 47,84 €. Versand kommt hinzu.',
          ],
          [
            'Was kostet der Versand?',
            `Der Versand kostet ${money(store.shipping.DE?.fee || 499)} für Deutschland und ${money(store.shipping.GB?.fee || 1199)} für Großbritannien. Im Warenkorb kannst du das Lieferland ändern und die Gesamtsumme sehen.`,
          ],
          [
            'Kann ich schon bestellen?',
            store.preview
              ? 'Du kannst den gesamten Shop und den Demo-Checkout ausprobieren. Bestellungen, Zahlungen und Newsletter-Versand sind in dieser Vorschau noch nicht aktiviert.'
              : 'Die verfügbaren Zahlungsarten werden im sicheren Checkout angezeigt. Versandkosten und Gesamtpreis siehst du vor dem Abschluss.',
          ],
        ]
      : [
          [
            'What are foxnuts?',
            'Foxnuts, also called makhana, are popped water-lily seeds. Our flavours range from creamy classics to bold peri peri. Always check the ingredients and allergens for your selected flavour before eating.',
          ],
          [
            'Can I build my own box?',
            'Yes. Our quiz recommends flavours and adds them in pairs. You can adjust your mix afterwards. An 8-pack is €23.92 and a 16-pack is €47.84, plus delivery.',
          ],
          [
            'How much is delivery?',
            `Delivery costs ${money(store.shipping.DE?.fee || 499)} for Germany and ${money(store.shipping.GB?.fee || 1199)} for the United Kingdom. Change the delivery country in your bag to see the total.`,
          ],
          [
            'Can I place an order yet?',
            store.preview
              ? 'You can explore the complete storefront and demo checkout. Real orders, payments and newsletter delivery are not activated in this preview.'
              : 'Available payment methods appear in the secure checkout. You see delivery costs and the total before completing your purchase.',
          ],
        ];
  return (
    <main>
      <Seo title={t('meta.homeTitle')} description={t('meta.homeDescription')} />
      <EditorialHero />
      <section className="ritual-strip" aria-label="EarthVeda Essentials">
        <div className="container">
          <span>
            <Sparkles size={17} aria-hidden="true" />
            {lang === 'de' ? 'Sieben Sorten Foxnuts' : 'Seven foxnut flavours'}
          </span>
          <span>
            <Coffee size={17} aria-hidden="true" />
            {lang === 'de' ? 'Drei Sorten Plant Protein' : 'Three Plant Protein flavours'}
          </span>
          <span>
            <Package size={17} aria-hidden="true" />
            {lang === 'de' ? 'Dein eigenes Mixpaket' : 'Build your own mix'}
          </span>
          <span>
            <Truck size={17} aria-hidden="true" />
            {lang === 'de' ? 'Deutschland & Großbritannien' : 'Germany & the United Kingdom'}
          </span>
        </div>
      </section>
      <DiscoverySection />
      <section className="rituals container" aria-labelledby="ritual-title">
        <div className="section-caption">
          <p className="eyebrow">{t('refresh.rituals.eyebrow')}</p>
          <span>01 / 03</span>
        </div>
        <h2 id="ritual-title" className="display-heading">
          {t('refresh.rituals.title')}
        </h2>
        <div className="rituals__grid">
          <article className="ritual-card ritual-card--snack">
            <span className="ritual-number">01</span>
            <div className="ritual-card__visual">
              {snack && <ProductImage product={snack} alt="" />}
              <span className="ritual-disc" aria-hidden="true">
                <Play size={24} />
              </span>
            </div>
            <h3>{t('refresh.rituals.one')}</h3>
            <p>{t('refresh.rituals.oneBody')}</p>
            <L
              to="shop"
              query={{ range: 'foxnuts' }}
              className="ritual-card__link"
              aria-label={t('refresh.products.foxnuts')}
            >
              <ArrowRight size={21} aria-hidden="true" />
            </L>
          </article>
          <article className="ritual-card ritual-card--shake">
            <span className="ritual-number">02</span>
            <div className="ritual-card__visual">
              {shake && <ProductImage product={shake} alt="" />}
            </div>
            <h3>{t('refresh.rituals.two')}</h3>
            <p>{t('refresh.rituals.twoBody')}</p>
            <L
              to="shop"
              query={{ range: 'protein' }}
              className="ritual-card__link"
              aria-label={t('refresh.products.protein')}
            >
              <ArrowRight size={21} aria-hidden="true" />
            </L>
          </article>
          <article className="ritual-card ritual-card--mix">
            <span className="ritual-number">03</span>
            <div className="mini-box" aria-hidden="true">
              {store.foxnuts.slice(0, 4).map((p) => (
                <div key={p.id} style={{ '--accent': p.accent }}>
                  <ProductImage product={p} alt="" />
                </div>
              ))}
              <span>
                MIX IT
                <br />
                YOUR WAY.
              </span>
            </div>
            <h3>{t('refresh.rituals.three')}</h3>
            <p>{t('refresh.rituals.threeBody')}</p>
            <L to="box" className="ritual-card__link" aria-label={t('nav.box')}>
              <ArrowRight size={21} aria-hidden="true" />
            </L>
          </article>
        </div>
      </section>
      <div className="quiz-stage">
        <div className="container">
          <div className="quiz-stage__intro">
            <p className="eyebrow">{t('refresh.quiz.eyebrow')}</p>
            <h2 className="display-heading">{t('refresh.quiz.title')}</h2>
            <p>{t('refresh.quiz.description')}</p>
          </div>
          <BoxBuilder />
          <p className="quiz-stage__note">{t('refresh.quiz.note')}</p>
        </div>
      </div>
      <section className="brand-story container" aria-labelledby="brand-story-title">
        <div className="brand-story__art" aria-hidden="true">
          <div className="brand-story__circle">
            EARTH
            <br />
            VEDA<span>ESSENTIALS</span>
          </div>
          <span className="brand-story__flower">✳</span>
          <div className="brand-story__pouches">
            {store.foxnuts.slice(0, 3).map((p) => (
              <ProductImage key={p.id} product={p} alt="" />
            ))}
          </div>
          <p>{t('refresh.story.stamp')}</p>
        </div>
        <div className="brand-story__copy">
          <p className="eyebrow">{t('refresh.story.eyebrow')}</p>
          <h2 id="brand-story-title" className="display-heading">
            {t('refresh.story.title')}
          </h2>
          <p>{t('refresh.story.body')}</p>
          <L to="story" className="btn btn--ink">
            {t('refresh.story.cta')}
            <ArrowRight size={17} aria-hidden="true" />
          </L>
        </div>
      </section>
      <section className="home-faq container" aria-labelledby="home-faq-title">
        <div>
          <p className="eyebrow">{t('refresh.faq.eyebrow')}</p>
          <h2 id="home-faq-title" className="display-heading">
            {t('refresh.faq.title')}
          </h2>
          <L to="faq" className="link link--arrow">
            {t('refresh.faq.cta')}
            <ArrowRight size={16} aria-hidden="true" />
          </L>
        </div>
        <div className="faq">
          {faqs.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
