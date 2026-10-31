import { ArrowUpRight } from 'lucide-react';
import { useConsent } from '../context/ConsentContext';
import { useStore } from '../context/StoreContext';
import { L, useI18n } from '../i18n/LanguageContext';
import { LeafMark } from './Logo';
import NewsletterForm from './NewsletterForm';
import PaymentMarks from './PaymentMarks';
import { config } from '../config';

export default function Footer() {
  const { t } = useI18n();
  const { business } = useStore();
  const consent = useConsent();
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="container">
        <NewsletterForm source="footer" variant="footer" />
      </div>
      <div className="container footer__grid">
        <div className="footer__brand">
          <p className="footer__mark">
            <LeafMark size={36} /> EarthVeda
          </p>
          <p>{t('footer.tagline')}</p>
          {business.instagram && (
            <a href={business.instagram} target="_blank" rel="noopener noreferrer" className="link">
              {t('footer.instagram')} <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          )}
        </div>
        <nav aria-label={t('footer.shop')}>
          <h3>{t('footer.shop')}</h3>
          <L to="shop" query={{ range: 'foxnuts' }}>
            {t('nav.foxnuts')}
          </L>
          <L to="shop" query={{ range: 'protein' }}>
            {t('nav.protein')}
          </L>
          <L to="box">{t('nav.box')}</L>
          <L to="story">{t('nav.story')}</L>
        </nav>
        <nav aria-label={t('footer.help')}>
          <h3>{t('footer.help')}</h3>
          <L to="track">{t('nav.track')}</L>
          <L to="shipping">{t('footer.shipping')}</L>
          <L to="faq">{t('nav.faq')}</L>
          <L to="contact">{t('nav.contact')}</L>
        </nav>
        <nav aria-label={t('footer.legal')}>
          <h3>{t('footer.legal')}</h3>
          <L to="imprint">{t('footer.imprint')}</L>
          <L to="terms">{t('footer.terms')}</L>
          <L to="privacy">{t('footer.privacy')}</L>
          <L to="withdrawal">{t('footer.withdrawal')}</L>
          <L to="accessibility">{t('footer.accessibility')}</L>
          <button type="button" className="footer__linkbtn" onClick={consent.openSettings}>
            {t('footer.cookies')}
          </button>
        </nav>
      </div>
      <div className="container footer__legalbar">
        <L to="withdraw" className="footer__withdraw">
          {t('footer.withdraw')}
        </L>
        <div className="footer__pay">
          <span>{config.preview ? t('refresh.footer.planned') : t('footer.payment')}</span>
          <PaymentMarks tone="dark" />
        </div>
      </div>
      <div className="container footer__wordmark" aria-hidden="true">
        EarthVeda
      </div>
      <div className="container footer__base">
        <span>
          © {year} {business.legalName || business.brand || 'Earthveda Essentials'}
        </span>
        <span>{t('footer.vat')}</span>
      </div>
    </footer>
  );
}
