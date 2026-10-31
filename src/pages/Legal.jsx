import { config } from '../config';
import Seo from '../components/Seo';
import { useStore } from '../context/StoreContext';
import { L, useI18n } from '../i18n/LanguageContext';
import { COUNTRIES } from '../../shared/markets.js';
import { LEGAL_VERSION, legalPage } from '../../shared/legal.js';
import StoreStatus from './StoreStatus';

/** Imprint, terms, cancellation policy, privacy, shipping, accessibility. */
export default function Legal({ slug }) {
  const { t, lang, money } = useI18n();
  const store = useStore();
  if (store.loading || store.error) return <StoreStatus />;
  const shippingRows = Object.entries(store.shipping).map(([code, s]) => ({
    country: COUNTRIES[code]?.name[lang] ?? code,
    fee: money(s.fee),
    freeFrom: s.freeFrom ? money(s.freeFrom) : null,
    eta: s.eta?.[lang] ?? '',
  }));
  const page = legalPage(slug, store.business, lang, {
    siteUrl: config.publicSiteUrl || window.location.origin,
    shippingRows,
    etaDE: store.shipping.DE?.eta?.[lang] ?? '',
    etaGB: store.shipping.GB?.eta?.[lang] ?? '',
    carriers: [
      ...new Set(
        Object.values(store.shipping)
          .map((s) => s.carrier)
          .filter(Boolean),
      ),
    ].join(', '),
  });
  return (
    <main className="page container narrow legal">
      <Seo title={page.title} description={page.sections[0]?.p?.[0]?.slice(0, 150)} />
      <h1>{page.title}</h1>
      {config.preview && <p className="notice">{t('refresh.legal.draft')}</p>}
      {slug === 'withdrawal' && (
        <p>
          <L className="btn btn--ink" to="withdraw">
            {t('footer.withdraw')}
          </L>
        </p>
      )}
      {page.sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          {s.p.map((p) => (
            <p key={p.slice(0, 60)}>{p}</p>
          ))}
          {s.ul && (
            <ul>
              {s.ul.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <p className="muted legal__version">
        {lang === 'de' ? `Stand: ${LEGAL_VERSION}` : `Last updated: ${LEGAL_VERSION}`}
      </p>
    </main>
  );
}
