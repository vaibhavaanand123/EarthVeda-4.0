import { ArrowRight, Info } from 'lucide-react';
import Seo from '../components/Seo';
import { L, useI18n } from '../i18n/LanguageContext';

export default function PreviewService({ type = 'orders' }) {
  const { lang, t } = useI18n();
  const content = {
    orders:
      lang === 'de'
        ? [
            'Noch keine echten Bestellungen.',
            'Dies ist die Shop-Vorschau. Du kannst Produkte entdecken, deinen Mix erstellen und den Demo-Checkout testen. Sendungsverfolgung steht nach dem Verkaufsstart zur Verfügung.',
          ]
        : [
            'Your first order is still to come.',
            'This is the storefront preview. Explore the flavours, build a box and try the demo checkout. Real order tracking becomes available when the shop opens.',
          ],
    newsletter:
      lang === 'de'
        ? [
            'Ein bisschen Vorfreude im Postfach.',
            'Newsletter-Anmeldungen und Bestätigungslinks werden mit dem echten Versanddienst verbunden. In dieser Vorschau werden keine E-Mails versendet.',
          ]
        : [
            'A little good news is on its way.',
            'Newsletter subscriptions and confirmation links will connect to the real email service. This preview does not send emails.',
          ],
    withdrawal:
      lang === 'de'
        ? [
            'Vertrag widerrufen',
            'In dieser Vorschau werden keine Verträge geschlossen. Es gibt deshalb keine echte Bestellung zu widerrufen. Vor dem Verkaufsstart wird diese Funktion mit dem Bestellsystem und einer sofortigen Eingangsbestätigung verbunden.',
          ]
        : [
            'Withdraw from a contract',
            'This preview does not conclude contracts, so there is no real order to withdraw. Before sales open, this function must connect to the order system and send an immediate receipt confirmation.',
          ],
  }[type];
  return (
    <main className="page container narrow">
      <Seo title={content[0]} noindex />
      <p className="eyebrow">EarthVeda Essentials</p>
      <h1>{content[0]}</h1>
      <div className="service-preview">
        <Info size={24} aria-hidden="true" />
        <p>{content[1]}</p>
      </div>
      <L to="shop" className="btn btn--ink">
        {t('refresh.preview.back')}
        <ArrowRight size={16} aria-hidden="true" />
      </L>
    </main>
  );
}
