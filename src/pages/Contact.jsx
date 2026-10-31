import { ArrowUpRight, Clock, Mail, Phone } from 'lucide-react';
import Seo from '../components/Seo';
import { useStore } from '../context/StoreContext';
import { L, useI18n } from '../i18n/LanguageContext';

export default function Contact() {
  const { t, lang } = useI18n();
  const { business } = useStore();
  return (
    <main className="page container narrow">
      <Seo title={t('contact.title')} description={t('contact.lede')} />
      <h1>{t('contact.title')}</h1>
      <p className="lede">{t('contact.lede')}</p>
      {!business.email && (
        <p className="notice">
          {lang === 'de'
            ? 'Die direkten Kontaktdaten werden vor dem Verkaufsstart ergänzt. In dieser Vorschau werden keine Nachrichten an einen Kundendienst versendet.'
            : 'Direct support details will be added before sales open. This preview does not send customer-service messages.'}
        </p>
      )}
      <ul className="contact-list">
        {business.email && (
          <li>
            <Mail aria-hidden="true" />
            <span>{t('contact.email')}</span>
            <a href={`mailto:${business.email}`}>{business.email}</a>
          </li>
        )}
        {business.phone && (
          <li>
            <Phone aria-hidden="true" />
            <span>{t('contact.phone')}</span>
            <a href={`tel:${business.phone.replace(/[^\d+]/g, '')}`}>{business.phone}</a>
          </li>
        )}
        {business.supportHours?.[lang] && (
          <li>
            <Clock aria-hidden="true" />
            <span>{t('contact.hours')}</span>
            <strong>{business.supportHours[lang]}</strong>
          </li>
        )}
        {business.instagram && (
          <li>
            <ArrowUpRight aria-hidden="true" />
            <span>{t('contact.instagram')}</span>
            <a href={business.instagram} target="_blank" rel="noopener noreferrer">
              @earthvedaessentials.de
            </a>
          </li>
        )}
      </ul>
      <L to="faq" className="btn btn--ink">
        {t('nav.faq')}
      </L>
    </main>
  );
}
