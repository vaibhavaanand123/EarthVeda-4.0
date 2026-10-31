import { useStore } from '../context/StoreContext';
import { useI18n } from '../i18n/LanguageContext';
import { config } from '../config';

export default function AnnouncementBar() {
  const { t, money, lang } = useI18n();
  const { shipping, bundles } = useStore();
  const box8 = bundles.find((b) => b.size === 8);
  const box16 = bundles.find((b) => b.size === 16);
  const items = [
    shipping.DE &&
      shipping.GB &&
      t('announce.shipping', { de: money(shipping.DE.fee), gb: money(shipping.GB.fee) }),
    box8 && box16 && t('announce.box', { box8: money(box8.price), box16: money(box16.price) }),
    t('announce.roasted'),
  ].filter(Boolean);
  return (
    <div className="announce">
      <p className="announce__track">
        {config.preview && (
          <span className="preview-label">
            <i aria-hidden="true" />
            {lang === 'de' ? 'Shop-Vorschau · Keine Zahlungen' : 'Store preview · No payments'}
          </span>
        )}
        {items.slice(0, 2).map((text) => (
          <span key={text}>{text}</span>
        ))}
      </p>
    </div>
  );
}
