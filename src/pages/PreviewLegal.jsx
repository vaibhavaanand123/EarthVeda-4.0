import { useStore } from '../context/StoreContext';
import { L, useI18n } from '../i18n/LanguageContext';
import Seo from '../components/Seo';

/** Accurate scope for the standalone preview. Merchant-specific legal review remains required. */
export default function PreviewLegal({ slug }) {
  const { lang, t, money } = useI18n();
  const { business, shipping } = useStore();
  const de = lang === 'de';
  const titles = {
    imprint: de ? 'Impressum' : 'Legal notice',
    terms: de ? 'AGB' : 'Terms and conditions',
    privacy: de ? 'Datenschutz' : 'Privacy',
    withdrawal: de ? 'Widerrufsbelehrung' : 'Withdrawal information',
    shipping: de ? 'Versand & Zahlung' : 'Delivery and payment',
    accessibility: de ? 'Barrierefreiheit' : 'Accessibility',
  };
  const title = titles[slug] || titles.privacy;
  const address = [
    business.legalName,
    business.legalForm,
    business.street,
    `${business.postalCode || ''} ${business.city || ''}`.trim(),
    business.country,
  ]
    .filter(Boolean)
    .join(', ');
  const missing = de
    ? 'Vor der öffentlichen Veröffentlichung zu ergänzen.'
    : 'Complete before public publication.';
  const sections = {
    imprint: [
      [
        de ? 'Anbieter nach § 5 DDG' : 'Provider under section 5 DDG',
        business.legalName ? address : missing,
      ],
      [de ? 'Kontakt' : 'Contact', business.email || missing],
      [
        de ? 'Vertretung und Register' : 'Representation and registration',
        [business.managingDirectors, business.registerCourt, business.registerNumber]
          .filter(Boolean)
          .join(', ') || missing,
      ],
      [de ? 'Umsatzsteuer-ID' : 'VAT identification', business.vatId || missing],
      [
        de ? 'Hinweis zur Vorschau' : 'About this preview',
        de
          ? 'Diese Website zeigt einen Shop im Aufbau. Es werden keine Bestellungen oder Zahlungen angenommen. Die Vorschau ersetzt nicht die erforderlichen Anbieterangaben.'
          : 'This website demonstrates a shop in development. It does not accept orders or payments. Preview status does not replace the required merchant identification.',
      ],
    ],
    terms: [
      [
        de ? 'Geltungsbereich der Vorschau' : 'Scope of this preview',
        de
          ? 'Produkte, Warenkorb und Checkout dienen zur Demonstration. Ein Klick auf „Demo abschließen“ gibt keine Bestellung ab und schließt keinen Kaufvertrag. Die angezeigten Preise und Versandkosten werden zur Veranschaulichung berechnet.'
          : 'Products, the shopping bag and checkout demonstrate the planned shop. Completing the demo does not submit an order or conclude a purchase contract. Prices and delivery costs are calculated to demonstrate the flow.',
      ],
      [
        de ? 'Vor dem Verkaufsstart' : 'Before sales open',
        de
          ? 'Verbindliche AGB müssen insbesondere Vertragspartner, Vertragsschluss, Zahlung, Lieferung, Gewährleistung und Verbraucherrechte passend zum tatsächlichen Geschäftsmodell festlegen und rechtlich geprüft werden.'
          : 'Binding terms must identify the merchant and accurately cover contract formation, payment, delivery, statutory warranty and consumer rights for the actual business model, with appropriate legal review.',
      ],
    ],
    privacy: [
      [
        de ? 'Verantwortlicher' : 'Controller',
        business.legalName && business.email ? `${address}; ${business.email}` : missing,
      ],
      [
        de ? 'Hosting' : 'Hosting',
        de
          ? 'Bei einem Aufruf verarbeitet der Hostinganbieter Vercel technische Verbindungsdaten wie IP-Adresse, Zeitpunkt, angefragte Dateien und Browserinformationen zur Auslieferung und Absicherung der Website. Die konkreten Verantwortlichen, Rechtsgrundlagen, Speicherfristen, Auftragsverarbeitungsverträge und gegebenenfalls Drittlandtransfers müssen anhand der tatsächlichen Einrichtung ergänzt und geprüft werden.'
          : 'When you visit, hosting provider Vercel processes technical connection data such as IP address, request time, requested files and browser information to deliver and secure the website. The actual controllers, legal bases, retention periods, processing agreements and any international transfers must be completed and reviewed for the deployed setup.',
      ],
      [de ? 'Lokaler Speicher' : 'Local storage', t('refresh.legal.essential')],
      [
        de ? 'Formulare in der Vorschau' : 'Forms in this preview',
        de
          ? 'Newsletter- und Checkout-Eingaben werden nur während der aktuellen Ansicht im Arbeitsspeicher des Browsers verarbeitet. Sie werden von dieser Vorschau nicht an einen Server gesendet und nicht im lokalen Speicher abgelegt. Bitte nutze Beispieldaten. Warenkorb und Merkliste enthalten Produkt-IDs und Mengen, keine Lieferadresse.'
          : 'Newsletter and demo checkout entries remain in browser memory for the current view. This preview does not send them to a server or put them in local storage. Please use example details. The saved shopping bag and wishlist contain product IDs and quantities, not delivery addresses.',
      ],
      [
        de ? 'Externe Links und Schriftarten' : 'External links and fonts',
        de
          ? 'Schriftarten und Produktbilder werden lokal ausgeliefert. Instagram ist nur verlinkt, nicht eingebettet. Erst beim Aufruf eines externen Links wird eine Verbindung zu diesem Anbieter hergestellt.'
          : 'Fonts and product images are hosted with the site. Instagram is linked, not embedded. A connection to an external provider is made when you follow its link.',
      ],
      [
        de ? 'Deine Rechte' : 'Your rights',
        de
          ? 'Je nach gesetzlichen Voraussetzungen bestehen Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch sowie Beschwerde bei einer zuständigen Datenschutzaufsichtsbehörde. Die Kontaktdaten des Verantwortlichen und die zuständige Aufsichtsbehörde müssen vor Veröffentlichung ergänzt werden.'
          : 'Subject to applicable conditions, you have rights of access, correction, erasure, restriction, portability, objection and complaint to a competent supervisory authority. Controller contact details and the competent authority must be completed before publication.',
      ],
    ],
    withdrawal: [
      [
        de ? 'Vorschau ohne Kaufvertrag' : 'Preview without a purchase contract',
        de
          ? 'In dieser Shop-Vorschau werden keine Verträge geschlossen. Der Demo-Checkout löst deshalb keine Bestellung aus. Für den echten Shop werden eine geprüfte Widerrufsbelehrung, das Musterformular und eine verbundene elektronische Widerrufsfunktion bereitgestellt.'
          : 'This storefront preview does not conclude contracts or submit orders. The live shop will need a reviewed withdrawal policy, a model form and a connected electronic withdrawal function.',
      ],
      [
        de ? 'Lebensmittel und Widerruf' : 'Food and withdrawal',
        de
          ? 'Lebensmittel sind nicht pauschal vom Widerruf ausgeschlossen. Ob Ausnahmen gelten, ist anhand der konkreten Ware und gesetzlichen Voraussetzungen zu prüfen. Eine pauschale Aussage, dass Snacks oder Proteinprodukte nicht zurückgegeben werden können, wird hier nicht getroffen.'
          : 'Food is not automatically excluded from withdrawal rights. Any exception must be assessed for the specific goods and legal conditions. This preview does not claim that all snacks or protein products are non-returnable.',
      ],
    ],
    shipping: [
      [de ? 'Deutschland' : 'Germany', `${money(shipping.DE.fee)} · EUR`],
      [de ? 'Vereinigtes Königreich' : 'United Kingdom', `${money(shipping.GB.fee)} · EUR`],
      [
        de ? 'Preise in der Vorschau' : 'Preview prices',
        de
          ? 'Einzelpackung 2,99 €. Mixpaket mit 8 Packungen 23,92 €, mit 16 Packungen 47,84 €. Die Vorschau berechnet den Versand pro Bestellung nach Lieferland. Die Preise werden einschließlich der konfigurierten Umsatzsteuer dargestellt. Steuersätze, Liefergebiete, Zollfragen für Großbritannien und Lieferzeiten müssen vor dem Verkaufsstart bestätigt werden.'
          : 'Single pack €2.99. An 8-pack is €23.92 and a 16-pack is €47.84. The preview adds delivery per order according to country. Displayed prices include the configured VAT. Tax treatment, delivery coverage, UK customs arrangements and delivery times need confirmation before sales open.',
      ],
      [
        de ? 'Zahlungen' : 'Payments',
        de
          ? 'In dieser Vorschau werden keine Zahlungen verarbeitet. Karten, PayPal, Klarna und Wallets sind als geplante Auswahl im Demo-Checkout sichtbar. Die spätere Verfügbarkeit hängt vom Zahlungsanbieter und freigeschalteten Händlerkonto ab.'
          : 'This preview does not process payments. Cards, PayPal, Klarna and wallets are shown as planned choices in the demonstration checkout. Actual availability depends on the payment provider and enabled merchant account.',
      ],
    ],
    accessibility: [
      [
        de ? 'Nutzung der Website' : 'Using this website',
        de
          ? 'Die Oberfläche verwendet beschriftete Eingaben, Tastaturnavigation, sichtbare Fokusmarkierungen, einen Sprunglink, Alternativtexte sowie die Systemeinstellung für reduzierte Bewegung. Die deutsche und englische Fassung sind über den Schalter im Kopfbereich erreichbar.'
          : 'The interface uses labelled inputs, keyboard navigation, visible focus styles, a skip link, alternative text and the system reduced-motion preference. German and English are available from the header switch.',
      ],
      [
        de ? 'Stand der Prüfung' : 'Verification status',
        de
          ? 'Dies ist keine zertifizierte Erklärung vollständiger Barrierefreiheit. Eine manuelle Prüfung mit Browser, Tastatur und Screenreader sowie die Prüfung der Anwendbarkeit des BFSG bleiben vor dem Verkaufsstart erforderlich. Barrieren können über die später zu ergänzenden Kontaktdaten gemeldet werden.'
          : 'This is not a certification of full accessibility. Manual browser, keyboard and screen-reader testing and an assessment of the applicable accessibility obligations remain necessary before sales open. Contact details for reporting barriers must be completed.',
      ],
    ],
  };
  return (
    <main className="page container narrow legal">
      <Seo title={title} noindex />
      <p className="eyebrow">EarthVeda Essentials</p>
      <h1>{title}</h1>
      <p className="notice">{t('refresh.legal.draft')}</p>
      {(sections[slug] || sections.privacy).map(([heading, body]) => (
        <section key={heading}>
          <h2>{heading}</h2>
          <p>{body}</p>
        </section>
      ))}
      {slug === 'withdrawal' && (
        <L to="withdraw" className="btn btn--ink">
          {t('footer.withdraw')}
        </L>
      )}
      <p className="muted legal__version">{de ? 'Stand' : 'Updated'}: 18.10.2026</p>
    </main>
  );
}
