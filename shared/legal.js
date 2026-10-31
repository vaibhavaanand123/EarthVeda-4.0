/**
 * Legal texts for Germany (binding: German) and the UK (English).
 * One source of truth for the website pages AND the order confirmation email.
 *
 * IMPORTANT: these are carefully prepared drafts, not legal advice. Have them
 * reviewed by a German e-commerce lawyer (or a service such as IT-Recht Kanzlei
 * / Händlerbund / Trusted Shops legal texts) before launch. Business details
 * come from Admin → Settings → Business and show "[…]" until filled in.
 */

import { PAYMENT_METHOD_NAMES } from './payments.js';
import { path } from './routes.js';

export { PAYMENT_METHOD_NAMES };

export const LEGAL_VERSION = '2026-10-10';

const missing = (lang) =>
  lang === 'de' ? '[bitte in den Einstellungen ergänzen]' : '[to be completed in settings]';
const v = (value, lang) => (value && String(value).trim() ? String(value).trim() : missing(lang));

export function businessAddressLines(b, lang) {
  return [
    [b?.legalName, b?.legalForm].filter(Boolean).join(' ') || v('', lang),
    v(b?.street, lang),
    `${b?.postalCode || ''} ${b?.city || ''}`.trim() || v('', lang),
    b?.country || (lang === 'de' ? 'Deutschland' : 'Germany'),
  ];
}

const contactLine = (b, lang) =>
  `${businessAddressLines(b, lang).join(', ')}; ${lang === 'de' ? 'E-Mail' : 'email'}: ${v(b?.email, lang)}${
    b?.phone ? `; ${lang === 'de' ? 'Telefon' : 'phone'}: ${b.phone}` : ''
  }`;

// ---------------------------------------------------------------------------
// Widerrufsbelehrung / Cancellation policy (also used in the confirmation email)
// ---------------------------------------------------------------------------

export function withdrawalPolicy(b, lang, siteUrl = '') {
  const fn = `${siteUrl}${path('withdraw', lang)}`;
  if (lang === 'de')
    return {
      title: 'Widerrufsbelehrung',
      sections: [
        {
          h: 'Widerrufsrecht',
          p: [
            'Verbraucher haben ein vierzehntägiges Widerrufsrecht. Verbraucher ist jede natürliche Person, die ein Rechtsgeschäft zu Zwecken abschließt, die überwiegend weder ihrer gewerblichen noch ihrer selbständigen beruflichen Tätigkeit zugerechnet werden können.',
            'Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.',
            'Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag, an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die Waren in Besitz genommen haben bzw. hat. Haben Sie mehrere Waren im Rahmen einer einheitlichen Bestellung bestellt, die getrennt geliefert werden, beginnt die Frist mit Besitznahme der letzten Ware.',
            `Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (${contactLine(b, 'de')}) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.`,
            `Sie können Ihr Widerrufsrecht auch online unter ${fn} (Schaltfläche „Vertrag widerrufen“ im Fußbereich jeder Seite) ausüben. Wenn Sie diese Online-Funktion nutzen, übermitteln wir Ihnen auf einem dauerhaften Datenträger (z. B. durch eine E-Mail) unverzüglich eine Eingangsbestätigung mit Informationen zum Inhalt der Widerrufserklärung sowie dem Datum und der Uhrzeit ihres Eingangs.`,
            'Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.',
          ],
        },
        {
          h: 'Folgen des Widerrufs',
          p: [
            'Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.',
            'Wir können die Rückzahlung verweigern, bis wir die Waren wieder zurückerhalten haben oder bis Sie den Nachweis erbracht haben, dass Sie die Waren zurückgesandt haben, je nachdem, welches der frühere Zeitpunkt ist.',
            `Sie haben die Waren unverzüglich und in jedem Fall spätestens binnen vierzehn Tagen ab dem Tag, an dem Sie uns über den Widerruf dieses Vertrags unterrichten, an uns (${businessAddressLines(b, 'de').join(', ')}) zurückzusenden oder zu übergeben. Die Frist ist gewahrt, wenn Sie die Waren vor Ablauf der Frist von vierzehn Tagen absenden.`,
            'Sie tragen die unmittelbaren Kosten der Rücksendung der Waren.',
            'Sie müssen für einen etwaigen Wertverlust der Waren nur aufkommen, wenn dieser Wertverlust auf einen zur Prüfung der Beschaffenheit, Eigenschaften und Funktionsweise der Waren nicht notwendigen Umgang mit ihnen zurückzuführen ist.',
          ],
        },
        {
          h: 'Ausschluss bzw. vorzeitiges Erlöschen des Widerrufsrechts',
          p: [
            'Das Widerrufsrecht erlischt vorzeitig bei Verträgen zur Lieferung versiegelter Waren, die aus Gründen des Gesundheitsschutzes oder der Hygiene nicht zur Rückgabe geeignet sind, wenn ihre Versiegelung nach der Lieferung entfernt wurde. Dies betrifft insbesondere geöffnete Lebensmittelverpackungen (Beutel und Dosen, deren Verschluss oder Siegel geöffnet wurde).',
          ],
        },
        {
          h: 'Muster-Widerrufsformular',
          p: [
            '(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)',
            `An: ${contactLine(b, 'de')}`,
            'Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*)',
            'Bestellt am (*)/erhalten am (*)',
            'Name des/der Verbraucher(s)',
            'Anschrift des/der Verbraucher(s)',
            'Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)',
            'Datum',
            '(*) Unzutreffendes streichen.',
          ],
        },
      ],
    };
  return {
    title: 'Cancellation policy',
    sections: [
      {
        h: 'Right to cancel',
        p: [
          'Consumers have a 14-day right to cancel. A consumer is any individual acting for purposes that are wholly or mainly outside their trade, business, craft or profession.',
          'You have the right to cancel this contract within 14 days without giving any reason.',
          'The cancellation period will expire after 14 days from the day on which you acquire, or a third party other than the carrier and indicated by you acquires, physical possession of the goods. If you ordered several goods in one order that are delivered separately, the period starts when you receive the last item.',
          `To exercise the right to cancel, you must inform us (${contactLine(b, 'en')}) of your decision to cancel this contract by a clear statement (e.g. a letter sent by post or an email). You may use the model cancellation form below, but it is not obligatory.`,
          `You can also exercise your right to cancel online at ${fn} (the "Withdraw from contract" button in the footer of every page). If you use this online function, we will send you an acknowledgement of receipt on a durable medium (e.g. by email) without delay, stating the content of your declaration and the date and time it was received.`,
          'To meet the cancellation deadline, it is sufficient for you to send your communication concerning your exercise of the right to cancel before the cancellation period has expired.',
        ],
      },
      {
        h: 'Effects of cancellation',
        p: [
          'If you cancel this contract, we will reimburse to you all payments received from you, including the costs of delivery (except for the supplementary costs arising if you chose a type of delivery other than the least expensive standard delivery offered by us), without undue delay and in any event not later than 14 days from the day on which we are informed about your decision to cancel this contract. We will make the reimbursement using the same means of payment as you used for the initial transaction, unless you have expressly agreed otherwise; in any event, you will not incur any fees as a result of the reimbursement.',
          'We may withhold reimbursement until we have received the goods back or you have supplied evidence of having sent back the goods, whichever is the earliest.',
          `You shall send back the goods or hand them over to us (${businessAddressLines(b, 'en').join(', ')}) without undue delay and in any event not later than 14 days from the day on which you communicate your cancellation of this contract to us. The deadline is met if you send back the goods before the period of 14 days has expired.`,
          'You will have to bear the direct cost of returning the goods.',
          'You are only liable for any diminished value of the goods resulting from handling other than what is necessary to establish the nature, characteristics and functioning of the goods.',
        ],
      },
      {
        h: 'Exceptions',
        p: [
          'The right to cancel ends early for sealed goods which are not suitable for return due to health protection or hygiene reasons, if they have been unsealed after delivery. This applies in particular to opened food packaging (pouches and jars whose seal or closure has been opened).',
        ],
      },
      {
        h: 'Model cancellation form',
        p: [
          '(Complete and return this form only if you wish to withdraw from the contract.)',
          `To: ${contactLine(b, 'en')}`,
          'I/We (*) hereby give notice that I/We (*) withdraw from my/our (*) contract of sale of the following goods (*)/for the provision of the following service (*),',
          'Ordered on (*)/received on (*),',
          'Name of consumer(s),',
          'Address of consumer(s),',
          'Signature of consumer(s) (only if this form is notified on paper),',
          'Date',
          '(*) Delete as appropriate.',
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function imprint(b, lang) {
  const addr = businessAddressLines(b, lang);
  if (lang === 'de')
    return {
      title: 'Impressum',
      sections: [
        { h: 'Angaben gemäß § 5 DDG', p: addr },
        {
          h: 'Kontakt',
          p: [`E-Mail: ${v(b?.email, lang)}`, ...(b?.phone ? [`Telefon: ${b.phone}`] : [])],
        },
        { h: 'Vertreten durch', p: [v(b?.managingDirectors, lang)] },
        {
          h: 'Registereintrag',
          p: [
            `Registergericht: ${v(b?.registerCourt, lang)}`,
            `Registernummer: ${v(b?.registerNumber, lang)}`,
          ],
        },
        {
          h: 'Umsatzsteuer-ID',
          p: [
            `Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: ${v(b?.vatId, lang)}`,
            ...(b?.ukVatNumber ? [`UK VAT Registration Number: ${b.ukVatNumber}`] : []),
          ],
        },
        {
          h: 'Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV',
          p: [v(b?.contentResponsible, lang)],
        },
        ...(b?.packagingRegister
          ? [
              {
                h: 'Verpackungsregister LUCID',
                p: [`Registrierungsnummer: ${b.packagingRegister}`],
              },
            ]
          : []),
        {
          h: 'Verbraucherstreitbeilegung',
          p: [
            'Wir sind zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle weder verpflichtet noch bereit.',
          ],
        },
      ],
    };
  return {
    title: 'Legal notice',
    sections: [
      { h: 'Information pursuant to § 5 DDG (German Digital Services Act)', p: addr },
      {
        h: 'Contact',
        p: [`Email: ${v(b?.email, lang)}`, ...(b?.phone ? [`Phone: ${b.phone}`] : [])],
      },
      { h: 'Represented by', p: [v(b?.managingDirectors, lang)] },
      {
        h: 'Commercial register',
        p: [
          `Register court: ${v(b?.registerCourt, lang)}`,
          `Register number: ${v(b?.registerNumber, lang)}`,
        ],
      },
      {
        h: 'VAT',
        p: [
          `German VAT ID (§ 27a UStG): ${v(b?.vatId, lang)}`,
          ...(b?.ukVatNumber ? [`UK VAT Registration Number: ${b.ukVatNumber}`] : []),
        ],
      },
      { h: 'Responsible for content (§ 18 (2) MStV)', p: [v(b?.contentResponsible, lang)] },
      ...(b?.packagingRegister
        ? [{ h: 'Packaging register LUCID', p: [`Registration number: ${b.packagingRegister}`] }]
        : []),
      {
        h: 'Consumer dispute resolution',
        p: [
          'We are neither obliged nor willing to take part in dispute resolution proceedings before a consumer arbitration board.',
        ],
      },
    ],
  };
}

function terms(b, lang, ctx) {
  const name = [b?.legalName, b?.legalForm].filter(Boolean).join(' ') || v('', lang);
  const pay = ctx.paymentMethods.join(', ');
  if (lang === 'de')
    return {
      title: 'Allgemeine Geschäftsbedingungen',
      sections: [
        {
          h: '§ 1 Geltungsbereich und Anbieter',
          p: [
            `Diese AGB gelten für alle Bestellungen über den Online-Shop ${ctx.siteUrl || 'earthvedaessentials.de'} zwischen Ihnen und ${name}, ${businessAddressLines(b, 'de').slice(1).join(', ')} („wir“).`,
            'Wir verkaufen ausschließlich an Verbraucher und liefern nach Deutschland und in das Vereinigte Königreich. Vertragssprachen sind Deutsch und Englisch; bei Widersprüchen gilt die deutsche Fassung.',
          ],
        },
        {
          h: '§ 2 Vertragsschluss',
          p: [
            'Die Darstellung der Produkte im Shop ist kein rechtlich bindendes Angebot, sondern eine Aufforderung zur Bestellung.',
            'Sie legen Produkte in den Warenkorb, geben Ihre Liefer- und Kontaktdaten ein und können alle Angaben vor dem Absenden prüfen und korrigieren. Mit Klick auf die Schaltfläche „Zahlungspflichtig bestellen“ geben Sie ein verbindliches Angebot zum Kauf ab und werden zur Zahlung an unseren Zahlungsdienstleister Stripe weitergeleitet.',
            'Der Vertrag kommt zustande, wenn wir Ihre Bestellung nach erfolgreicher Zahlung per E-Mail bestätigen (Bestellbestätigung). Wird die Zahlung nicht abgeschlossen, kommt kein Vertrag zustande.',
            'Wir speichern den Vertragstext. Die Bestelldaten und diese AGB senden wir Ihnen mit der Bestellbestätigung per E-Mail. Frühere Bestellungen können Sie über die Funktion „Bestellung verfolgen“ einsehen.',
          ],
        },
        {
          h: '§ 3 Preise und Versandkosten',
          p: [
            'Alle Preise sind Endpreise in Euro und enthalten die gesetzliche Mehrwertsteuer. Zusätzlich fallen Versandkosten an, die im Warenkorb und auf der Seite „Versand & Zahlung“ ausgewiesen sind.',
            'Bei Lieferungen in das Vereinigte Königreich ist die britische Mehrwertsteuer im Preis enthalten, soweit wir sie beim Verkauf erheben (Sendungen bis 135 GBP). Für Sendungen über diesem Wert können bei der Einfuhr Zölle oder Abgaben anfallen, die vom Empfänger zu tragen sind; wir weisen Sie vor der Bestellung darauf hin.',
          ],
        },
        {
          h: '§ 4 Zahlung',
          p: [
            `Die Zahlung erfolgt über Stripe. Je nach Verfügbarkeit stehen zur Auswahl: ${pay}. Bei Klarna und PayPal gelten zusätzlich deren Bedingungen.`,
            'Ihre Zahlungsdaten werden ausschließlich vom Zahlungsdienstleister verarbeitet; wir erhalten keine vollständigen Kartendaten.',
          ],
        },
        {
          h: '§ 5 Lieferung',
          p: [
            `Wir liefern mit ${ctx.carriers || 'DHL'}. Die Lieferzeit beträgt nach Deutschland ${ctx.etaDE} und in das Vereinigte Königreich ${ctx.etaGB} ab Zahlungseingang, sofern beim Produkt nichts anderes angegeben ist.`,
            'Ist ein Produkt nach Ihrer Bestellung nicht verfügbar, informieren wir Sie unverzüglich und erstatten bereits geleistete Zahlungen.',
          ],
        },
        {
          h: '§ 6 Eigentumsvorbehalt',
          p: ['Die Ware bleibt bis zur vollständigen Bezahlung unser Eigentum.'],
        },
        {
          h: '§ 7 Widerrufsrecht',
          p: [
            'Verbrauchern steht ein Widerrufsrecht nach Maßgabe der Widerrufsbelehrung zu. Den Widerruf können Sie auch online über die Schaltfläche „Vertrag widerrufen“ erklären.',
          ],
        },
        {
          h: '§ 8 Gewährleistung',
          p: [
            'Es gelten die gesetzlichen Mängelrechte. Bitte prüfen Sie die Ware bei Lieferung und melden Sie Transportschäden möglichst sofort; Ihre gesetzlichen Rechte bleiben davon unberührt.',
            'Bitte beachten Sie das Mindesthaltbarkeitsdatum und die Lagerhinweise auf der Verpackung.',
          ],
        },
        {
          h: '§ 9 Haftung',
          p: [
            'Wir haften unbeschränkt für Vorsatz und grobe Fahrlässigkeit, bei Verletzung von Leben, Körper oder Gesundheit sowie nach dem Produkthaftungsgesetz. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt. Im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen.',
          ],
        },
        {
          h: '§ 10 Streitbeilegung und Schlussbestimmungen',
          p: [
            'Wir sind zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle weder verpflichtet noch bereit.',
            'Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Zwingende Verbraucherschutzvorschriften des Staates, in dem Sie Ihren gewöhnlichen Aufenthalt haben (z. B. des Vereinigten Königreichs), bleiben unberührt.',
          ],
        },
      ],
    };
  return {
    title: 'Terms and conditions',
    sections: [
      {
        h: '1. Scope and seller',
        p: [
          `These terms apply to all orders placed in the online shop ${ctx.siteUrl || 'earthvedaessentials.de'} between you and ${name}, ${businessAddressLines(b, 'en').slice(1).join(', ')} ("we", "us").`,
          'We sell to consumers only and deliver to Germany and the United Kingdom. Contract languages are German and English; this English version is a translation and, for customers in Germany, the German version prevails.',
        ],
      },
      {
        h: '2. How the contract is formed',
        p: [
          'Products shown in the shop are not a binding offer but an invitation to order.',
          'You add products to your bag, enter delivery and contact details and can review and correct everything before you submit. By clicking "Order and pay" you make a binding offer to buy and are redirected to our payment provider Stripe.',
          'The contract is concluded when we confirm your order by email after successful payment (order confirmation). If payment is not completed, no contract is formed.',
          'We store the contract text. We email you the order details and these terms with your order confirmation.',
        ],
      },
      {
        h: '3. Prices and shipping',
        p: [
          'All prices are final prices in euros and include VAT. Shipping costs are added and shown in the bag and on the "Shipping & payment" page.',
          'For deliveries to the United Kingdom, UK VAT is included in the price where we collect it at the point of sale (consignments up to GBP 135). Above that value, import duties or charges may be payable by the recipient; we will tell you before you order.',
        ],
      },
      {
        h: '4. Payment',
        p: [
          `Payment is processed by Stripe. Depending on availability you can choose: ${pay}. Klarna and PayPal terms also apply when you use them.`,
          'Your payment details are processed only by the payment provider; we never receive full card details.',
        ],
      },
      {
        h: '5. Delivery',
        p: [
          `We ship with ${ctx.carriers || 'DHL'}. Delivery takes ${ctx.etaDE} to Germany and ${ctx.etaGB} to the United Kingdom after payment, unless stated otherwise on the product.`,
          'If a product is unavailable after you order, we will tell you without delay and refund any payment.',
        ],
      },
      { h: '6. Retention of title', p: ['Goods remain our property until paid in full.'] },
      {
        h: '7. Right to cancel',
        p: [
          'Consumers have a right to cancel as set out in the cancellation policy. You can also cancel online using the "Withdraw from contract" button.',
        ],
      },
      {
        h: '8. Statutory rights',
        p: [
          'Your statutory rights for faulty goods apply. Please check goods on delivery and report transport damage as soon as possible; this does not affect your statutory rights.',
          'Please observe the best-before date and storage instructions on the pack.',
        ],
      },
      {
        h: '9. Liability',
        p: [
          'We are liable without limitation for intent and gross negligence, for injury to life, body or health and under product liability law. For slightly negligent breaches of essential contractual obligations, liability is limited to typical, foreseeable damage. Otherwise, liability for slight negligence is excluded.',
        ],
      },
      {
        h: '10. Disputes and final provisions',
        p: [
          'We are neither obliged nor willing to take part in dispute resolution proceedings before a consumer arbitration board.',
          'German law applies, excluding the UN Convention on Contracts for the International Sale of Goods. Mandatory consumer protection rules of the country where you live (for example the United Kingdom) remain unaffected.',
        ],
      },
    ],
  };
}

function privacy(b, lang) {
  const controller = `${businessAddressLines(b, lang).join(', ')}, ${lang === 'de' ? 'E-Mail' : 'email'}: ${v(b?.email, lang)}`;
  if (lang === 'de')
    return {
      title: 'Datenschutzerklärung',
      sections: [
        { h: '1. Verantwortlicher', p: [controller] },
        {
          h: '2. Hosting und Server-Logfiles',
          p: [
            'Beim Aufruf der Website verarbeitet unser Server technisch notwendige Daten (IP-Adresse, Datum und Uhrzeit, abgerufene Seite, Browser). Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (sicherer und stabiler Betrieb). IP-Adressen speichern wir für Bestellungen und Formulare nur als nicht rückrechenbaren Hashwert. Logfiles werden nach spätestens 14 Tagen gelöscht.',
            'Die Website wird bei einem Hosting-Anbieter innerhalb der EU betrieben, mit dem ein Auftragsverarbeitungsvertrag besteht. [Anbieter bitte ergänzen]',
          ],
        },
        {
          h: '3. Bestellungen',
          p: [
            'Für die Abwicklung Ihrer Bestellung verarbeiten wir Name, Anschrift, E-Mail-Adresse, Telefonnummer, Bestell- und Zahlungsstatus (Art. 6 Abs. 1 lit. b DSGVO). Die Telefonnummer benötigen wir für Rückfragen und, bei Lieferungen in das Vereinigte Königreich, für die Zollabwicklung.',
            'Zur Lieferung geben wir Name, Anschrift und gegebenenfalls Telefonnummer an das Versandunternehmen (z. B. DHL) weiter. Ihre E-Mail-Adresse geben wir nur mit Ihrer Einwilligung zur Sendungsbenachrichtigung weiter.',
            'Bestell- und Rechnungsdaten bewahren wir wegen handels- und steuerrechtlicher Pflichten bis zu zehn Jahre auf (§ 147 AO, § 257 HGB).',
          ],
        },
        {
          h: '4. Zahlung über Stripe',
          p: [
            'Zahlungen werden über Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Dublin 2, Irland, abgewickelt. Stripe verarbeitet Ihre Zahlungsdaten zur Durchführung der Zahlung und zur Betrugsprävention (Art. 6 Abs. 1 lit. b und f DSGVO). Dabei können Daten an Stripe, Inc. in den USA übermittelt werden; Stripe ist unter dem EU-US Data Privacy Framework zertifiziert. Wählen Sie PayPal oder Klarna, werden Ihre Daten zusätzlich an PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxemburg, bzw. Klarna Bank AB, Stockholm, übermittelt, die in eigener Verantwortung handeln.',
          ],
        },
        {
          h: '5. E-Mail und WhatsApp',
          p: [
            'Bestell- und Versandbestätigungen senden wir per E-Mail über unseren E-Mail-Versanddienstleister (Auftragsverarbeiter). [Anbieter bitte ergänzen]',
            'Wenn Sie im Checkout zustimmen, senden wir Ihnen Bestell- und Versandinformationen auch per WhatsApp über die WhatsApp Business Platform der Meta Platforms Ireland Ltd. Dabei können Daten in die USA übermittelt werden (EU-US Data Privacy Framework). Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die Sie jederzeit widerrufen können.',
          ],
        },
        {
          h: '6. Newsletter',
          p: [
            'Für den Newsletter nutzen wir das Double-Opt-in-Verfahren: Sie erhalten eine E-Mail mit einem Bestätigungslink; erst danach senden wir Ihnen Neuigkeiten und Angebote. Wir protokollieren Anmeldung und Bestätigung (Zeitpunkt, Einwilligungstext, gehashte IP-Adresse) als Nachweis. Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Sie können sich jederzeit über den Link in jeder E-Mail abmelden.',
          ],
        },
        {
          h: '7. Online-Widerruf',
          p: [
            'Wenn Sie die Funktion „Vertrag widerrufen“ nutzen, verarbeiten wir Name, E-Mail-Adresse, Bestellnummer und Ihre Angaben zum Umfang des Widerrufs, um den Widerruf zu bearbeiten und Ihnen eine Eingangsbestätigung zu senden (Art. 6 Abs. 1 lit. c DSGVO). Die Daten speichern wir für die Dauer der gesetzlichen Aufbewahrungsfristen.',
          ],
        },
        {
          h: '8. Cookies und lokaler Speicher',
          p: [
            'Wir speichern in Ihrem Browser nur, was für den Shop technisch notwendig ist: Warenkorb, Merkliste, Sprachauswahl und Ihre Cookie-Entscheidung (§ 25 Abs. 2 Nr. 2 TDDDG). Im Admin-Bereich setzen wir ein Sitzungs-Cookie für angemeldete Mitarbeitende.',
            'Analyse- oder Marketing-Tools setzen wir nur nach Ihrer Einwilligung über das Cookie-Banner ein (§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO). Ihre Auswahl können Sie jederzeit über „Cookie-Einstellungen“ im Fußbereich ändern.',
            'Schriften werden lokal von unserem Server geladen; es findet keine Verbindung zu Google Fonts statt.',
          ],
        },
        {
          h: '9. Ihre Rechte',
          p: [
            'Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15 bis 21 DSGVO) sowie das Recht, erteilte Einwilligungen jederzeit für die Zukunft zu widerrufen. Sie können sich bei einer Datenschutz-Aufsichtsbehörde beschweren, insbesondere in dem Bundesland unseres Sitzes. Kundinnen und Kunden im Vereinigten Königreich können sich an das Information Commissioner’s Office (ICO) wenden.',
          ],
        },
      ],
    };
  return {
    title: 'Privacy policy',
    sections: [
      { h: '1. Controller', p: [controller] },
      {
        h: '2. Hosting and server logs',
        p: [
          'When you visit the website our server processes technically necessary data (IP address, date and time, page requested, browser). The legal basis is Art. 6(1)(f) GDPR (secure, stable operation). For orders and forms we store IP addresses only as a one-way hash. Logs are deleted after 14 days at the latest.',
          'The website is hosted by a provider within the EU under a data processing agreement. [provider to be completed]',
        ],
      },
      {
        h: '3. Orders',
        p: [
          'To process your order we use your name, address, email, phone number, order and payment status (Art. 6(1)(b) GDPR). We need your phone number for questions about your order and, for deliveries to the UK, for customs clearance.',
          'For delivery we pass your name, address and, where needed, phone number to the carrier (e.g. DHL). We share your email for delivery notifications only with your consent.',
          'We keep order and invoice data for up to ten years to meet German commercial and tax law (§ 147 AO, § 257 HGB).',
        ],
      },
      {
        h: '4. Payment via Stripe',
        p: [
          'Payments are processed by Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Dublin 2, Ireland, to execute the payment and prevent fraud (Art. 6(1)(b) and (f) GDPR). Data may be transferred to Stripe, Inc. in the USA; Stripe is certified under the EU-US Data Privacy Framework. If you choose PayPal or Klarna, your data is also shared with PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxembourg, or Klarna Bank AB, Stockholm, which act as independent controllers.',
        ],
      },
      {
        h: '5. Email and WhatsApp',
        p: [
          'We send order and shipping confirmations by email through our email delivery provider (processor). [provider to be completed]',
          'If you agree at checkout, we also send order and shipping updates via the WhatsApp Business Platform of Meta Platforms Ireland Ltd. Data may be transferred to the USA (EU-US Data Privacy Framework). The legal basis is your consent (Art. 6(1)(a) GDPR), which you can withdraw at any time.',
        ],
      },
      {
        h: '6. Newsletter',
        p: [
          'Our newsletter uses double opt-in: you receive an email with a confirmation link and only then do we send news and offers. We log sign-up and confirmation (time, consent text, hashed IP address) as proof. The legal basis is your consent (Art. 6(1)(a) GDPR). You can unsubscribe at any time using the link in every email.',
        ],
      },
      {
        h: '7. Online cancellation',
        p: [
          'If you use the "Withdraw from contract" function, we process your name, email, order number and the scope of your cancellation to handle it and send you an acknowledgement of receipt (Art. 6(1)(c) GDPR). We keep this data for the statutory retention periods.',
        ],
      },
      {
        h: '8. Cookies and local storage',
        p: [
          'We store in your browser only what the shop needs to work: your bag, wishlist, language and your cookie choice (§ 25(2) no. 2 TDDDG). The admin area uses a session cookie for signed-in staff.',
          'Analytics or marketing tools are only used with your consent via the cookie banner (§ 25(1) TDDDG, Art. 6(1)(a) GDPR). You can change your choice at any time via "Cookie settings" in the footer.',
          'Fonts are served from our own server; there is no connection to Google Fonts.',
        ],
      },
      {
        h: '9. Your rights',
        p: [
          'You have the right of access, rectification, erasure, restriction, data portability and objection (Art. 15 to 21 GDPR, and the UK GDPR for UK customers) and may withdraw consent at any time with effect for the future. You may complain to a data protection supervisory authority; customers in the UK may contact the Information Commissioner’s Office (ICO).',
        ],
      },
    ],
  };
}

function shippingPage(lang, ctx) {
  const rows = ctx.shippingRows;
  if (lang === 'de')
    return {
      title: 'Versand & Zahlung',
      sections: [
        {
          h: 'Liefergebiete und Versandkosten',
          p: [
            'Wir liefern nach Deutschland und in das Vereinigte Königreich. Alle Preise in Euro inkl. MwSt.',
          ],
          ul: rows.map(
            (r) =>
              `${r.country}: ${r.fee}${r.freeFrom ? `, versandkostenfrei ab ${r.freeFrom}` : ''}, Lieferzeit ${r.eta}`,
          ),
        },
        {
          h: 'Lieferung in das Vereinigte Königreich',
          p: [
            'Sendungen in das Vereinigte Königreich werden verzollt. Bis zu einem Warenwert von 135 GBP ist die britische Mehrwertsteuer in unserem Preis enthalten. Bitte gib eine erreichbare Telefonnummer an; der Zustelldienst benötigt sie für die Zollabwicklung.',
          ],
        },
        {
          h: 'Zahlungsarten',
          p: [
            `Du bezahlst sicher über Stripe: ${ctx.paymentMethods.join(', ')}. Die angezeigten Zahlungsarten können je nach Land, Gerät und Bestellwert variieren.`,
            'Die Zahlung wird bei Abschluss der Bestellung belastet. Bei Klarna gelten die Bedingungen von Klarna (z. B. Rechnung in 30 Tagen).',
          ],
        },
      ],
    };
  return {
    title: 'Shipping & payment',
    sections: [
      {
        h: 'Where we deliver and what it costs',
        p: ['We deliver to Germany and the United Kingdom. All prices in euros incl. VAT.'],
        ul: rows.map(
          (r) =>
            `${r.country}: ${r.fee}${r.freeFrom ? `, free from ${r.freeFrom}` : ''}, delivery ${r.eta}`,
        ),
      },
      {
        h: 'Delivery to the United Kingdom',
        p: [
          'UK parcels are customs cleared. For goods up to GBP 135, UK VAT is included in our price. Please give a phone number we can reach; the courier needs it for customs.',
        ],
      },
      {
        h: 'Payment methods',
        p: [
          `Pay securely via Stripe: ${ctx.paymentMethods.join(', ')}. The methods shown may vary by country, device and order value.`,
          'Your payment is taken when you complete the order. Klarna terms apply when you pay with Klarna (e.g. pay in 30 days).',
        ],
      },
    ],
  };
}

function accessibility(b, lang) {
  if (lang === 'de')
    return {
      title: 'Erklärung zur Barrierefreiheit',
      sections: [
        {
          h: 'Unser Anspruch',
          p: [
            'Wir möchten, dass alle bei uns einkaufen können. Der Shop ist nach WCAG 2.1 Stufe AA gestaltet: vollständig per Tastatur bedienbar, mit sichtbarem Fokus, Textalternativen für Bilder, ausreichenden Kontrasten, beschrifteten Formularfeldern und Unterstützung für reduzierte Bewegung.',
          ],
        },
        {
          h: 'Bekannte Einschränkungen',
          p: [
            'Die Zahlungsseite wird von unserem Zahlungsdienstleister Stripe bereitgestellt; auf ihre Gestaltung haben wir nur begrenzten Einfluss.',
          ],
        },
        {
          h: 'Feedback und Kontakt',
          p: [
            `Wenn dir Barrieren auffallen, schreib uns bitte an ${v(b?.email, lang)}. Wir antworten innerhalb von zwei Wochen.`,
            'Zuständige Marktüberwachungsbehörde: Marktüberwachungsstelle der Länder für die Barrierefreiheit von Produkten und Dienstleistungen (MLBF), Magdeburg.',
          ],
        },
      ],
    };
  return {
    title: 'Accessibility statement',
    sections: [
      {
        h: 'Our commitment',
        p: [
          'We want everyone to be able to shop with us. The shop is built to WCAG 2.1 level AA: fully keyboard operable, with visible focus, text alternatives for images, sufficient contrast, labelled form fields and support for reduced motion.',
        ],
      },
      {
        h: 'Known limitations',
        p: [
          'The payment page is provided by our payment provider Stripe; we have limited control over its design.',
        ],
      },
      {
        h: 'Feedback and contact',
        p: [
          `If you find a barrier, please email ${v(b?.email, lang)}. We reply within two weeks.`,
          'Market surveillance authority (Germany): Marktüberwachungsstelle der Länder für die Barrierefreiheit von Produkten und Dienstleistungen (MLBF), Magdeburg.',
        ],
      },
    ],
  };
}

/**
 * @param {object} b business settings
 * @param {'de'|'en'} lang
 * @param {{ siteUrl?: string, shippingRows: Array, etaDE: string, etaGB: string, carriers?: string }} ctx
 */
export function legalPage(slug, b, lang, ctx) {
  const full = { paymentMethods: PAYMENT_METHOD_NAMES, ...ctx };
  switch (slug) {
    case 'imprint':
      return imprint(b, lang);
    case 'terms':
      return terms(b, lang, full);
    case 'withdrawal':
      return withdrawalPolicy(b, lang, ctx.siteUrl);
    case 'privacy':
      return privacy(b, lang);
    case 'shipping':
      return shippingPage(lang, full);
    case 'accessibility':
      return accessibility(b, lang);
    default:
      return null;
  }
}

/** Plain text for emails (durable medium). */
export function asPlainText(page) {
  return [
    page.title.toUpperCase(),
    ...page.sections.flatMap((s) => ['', s.h, ...s.p, ...(s.ul || []).map((x) => `- ${x}`)]),
  ].join('\n');
}
