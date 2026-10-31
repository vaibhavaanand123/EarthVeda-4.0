import { COUNTRIES, formatDateTime, formatMoney } from '../../shared/markets.js';
import { statusLabel } from '../../shared/orderStatus.js';

/**
 * Email + WhatsApp templates. Payloads are snapshots taken when the message
 * was queued, so a retry hours later still sends exactly what happened.
 */

const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const T = {
  de: {
    hello: (n) => `Hallo ${n},`,
    orderNo: 'Bestellnummer',
    items: 'Deine Bestellung',
    subtotal: 'Zwischensumme',
    shipping: 'Versand',
    discount: 'Rabatt',
    total: 'Gesamt',
    paid: 'Bezahlt',
    vatIncl: (rate, amount) => `enthaltene MwSt. ${rate} %: ${amount}`,
    shipTo: 'Lieferadresse',
    track: 'Bestellung verfolgen',
    questions: 'Fragen? Antworte einfach auf diese E-Mail.',
    footer: 'Du erhältst diese E-Mail wegen deiner Bestellung bei Earthveda Essentials.',
    legalHead: 'Rechtliche Informationen zu deinem Vertrag',
    terms: 'Es gelten unsere AGB',
    eta: (e) => `Voraussichtliche Lieferzeit: ${e}.`,
    box: (n) => `${n} Packungen`,
  },
  en: {
    hello: (n) => `Hi ${n},`,
    orderNo: 'Order number',
    items: 'Your order',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    discount: 'Discount',
    total: 'Total',
    paid: 'Paid',
    vatIncl: (rate, amount) => `incl. VAT ${rate}%: ${amount}`,
    shipTo: 'Delivery address',
    track: 'Track your order',
    questions: 'Questions? Just reply to this email.',
    footer: 'You are receiving this email because of your order with Earthveda Essentials.',
    legalHead: 'Legal information about your contract',
    terms: 'Our terms and conditions apply',
    eta: (e) => `Estimated delivery: ${e}.`,
    box: (n) => `${n} packs`,
  },
};

function layout({ lang, preheader, title, bodyHtml, footerNote, siteUrl }) {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#eef1ea;font-family:Arial,Helvetica,sans-serif;color:#12372a">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1ea"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#12372a;padding:22px 28px"><a href="${esc(siteUrl)}" style="color:#ffffff;text-decoration:none;font-size:22px;font-weight:bold;letter-spacing:-0.5px">earthveda <span style="font-size:11px;letter-spacing:3px;color:#e9b949">ESSENTIALS</span></a></td></tr>
<tr><td style="padding:28px">${bodyHtml}</td></tr>
<tr><td style="padding:18px 28px;background:#f6f8f3;color:#53665a;font-size:12px;line-height:1.5">${footerNote}</td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href, label) =>
  `<p style="margin:24px 0"><a href="${esc(href)}" style="display:inline-block;background:#12372a;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:999px">${esc(label)}</a></p>`;

function orderTable(order, lang) {
  const t = T[lang];
  const money = (c) => esc(formatMoney(c, lang));
  const row = (label, value, strong = false) =>
    `<tr><td style="padding:4px 0;color:#53665a">${esc(label)}</td><td align="right" style="padding:4px 0;${strong ? 'font-weight:bold;font-size:16px' : ''}">${value}</td></tr>`;
  const lines = order.lines
    .map(
      (l) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #e2e8dc">${l.quantity} × <strong>${esc(l.name)}</strong>${
          l.picks
            ? `<br><span style="color:#53665a;font-size:13px">${l.picks.map((p) => `${p.quantity}× ${esc(p.name)}`).join(', ')}</span>`
            : ''
        }</td><td align="right" style="padding:10px 0;border-bottom:1px solid #e2e8dc;white-space:nowrap">${money(l.lineTotal)}</td></tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${lines}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-top:12px">
${row(t.subtotal, money(order.subtotal))}
${row(t.shipping, money(order.shipping))}
${order.discount ? row(t.discount, `-${money(order.discount)}`) : ''}
${row(order.amountPaid != null ? t.paid : t.total, money(order.amountPaid ?? order.total), true)}
${order.vat.map((v) => `<tr><td colspan="2" align="right" style="color:#53665a;font-size:12px">${esc(t.vatIncl(v.rate, formatMoney(v.amount, lang)))}</td></tr>`).join('')}
</table>`;
}

const addressBlock = (c, lang) =>
  [
    `${c.firstName} ${c.lastName}`,
    c.company,
    c.street,
    c.address2,
    `${c.postalCode} ${c.city}`,
    COUNTRIES[c.country]?.name[lang] || c.country,
  ]
    .filter(Boolean)
    .map(esc)
    .join('<br>');

const orderText = (order, lang) => {
  const t = T[lang];
  const money = (c) => formatMoney(c, lang);
  return [
    `${t.orderNo}: ${order.orderNumber}`,
    '',
    ...order.lines.map(
      (l) =>
        `${l.quantity} x ${l.name}  ${money(l.lineTotal)}${l.picks ? `\n   ${l.picks.map((p) => `${p.quantity}x ${p.name}`).join(', ')}` : ''}`,
    ),
    '',
    `${t.subtotal}: ${money(order.subtotal)}`,
    `${t.shipping}: ${money(order.shipping)}`,
    ...(order.discount ? [`${t.discount}: -${money(order.discount)}`] : []),
    `${t.total}: ${money(order.amountPaid ?? order.total)}`,
    ...order.vat.map((v) => t.vatIncl(v.rate, money(v.amount))),
  ].join('\n');
};

const legalHtml = (legal, lang) =>
  legal
    ? `<hr style="border:0;border-top:1px solid #e2e8dc;margin:28px 0">
<p style="font-size:12px;color:#53665a;margin:0 0 6px"><strong>${esc(T[lang].legalHead)}</strong></p>
<p style="font-size:12px;color:#53665a;margin:0 0 6px">${esc(T[lang].terms)}: <a href="${esc(legal.termsUrl)}" style="color:#12372a">${esc(legal.termsUrl)}</a></p>
<pre style="white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#53665a;margin:0">${esc(legal.withdrawalText)}</pre>`
    : '';

const TEMPLATES = {
  order_confirmation(p) {
    const { order, lang } = p;
    const t = T[lang];
    const subject =
      lang === 'de'
        ? `Bestellbestätigung ${order.orderNumber}`
        : `Order confirmation ${order.orderNumber}`;
    const intro =
      lang === 'de'
        ? 'danke für deine Bestellung! Deine Zahlung ist eingegangen und wir packen dein Paket. Hiermit bestätigen wir den Kaufvertrag.'
        : 'thank you for your order! We have received your payment and are packing your parcel. This email confirms your purchase contract.';
    const html = layout({
      lang,
      siteUrl: p.siteUrl,
      title: subject,
      preheader: `${t.orderNo} ${order.orderNumber}`,
      bodyHtml: `<h1 style="font-size:24px;margin:0 0 12px">${esc(t.hello(order.customer.firstName))}</h1>
<p style="line-height:1.6">${esc(intro)}</p>
<p style="background:#eef1ea;border-radius:10px;padding:12px 16px;margin:18px 0"><span style="color:#53665a">${esc(t.orderNo)}</span><br><strong style="font-size:18px;letter-spacing:1px">${esc(order.orderNumber)}</strong></p>
${orderTable(order, lang)}
<p style="margin-top:22px"><strong>${esc(t.shipTo)}</strong><br>${addressBlock(order.customer, lang)}</p>
${p.eta ? `<p>${esc(t.eta(p.eta))}</p>` : ''}
${button(p.trackUrl, t.track)}
<p style="color:#53665a">${esc(t.questions)}</p>
${legalHtml(p.legal, lang)}`,
      footerNote: esc(p.footer || t.footer),
    });
    const text = [
      t.hello(order.customer.firstName),
      '',
      intro,
      '',
      orderText(order, lang),
      '',
      `${t.shipTo}:`,
      addressBlock(order.customer, lang).replace(/<br>/g, '\n'),
      '',
      `${t.track}: ${p.trackUrl}`,
      '',
      ...(p.legal ? [`${t.terms}: ${p.legal.termsUrl}`, '', p.legal.withdrawalText] : []),
    ].join('\n');
    return { subject, html, text };
  },

  order_shipped(p) {
    const { order, lang } = p;
    const t = T[lang];
    const subject =
      lang === 'de'
        ? `Deine Bestellung ${order.orderNumber} ist unterwegs`
        : `Your order ${order.orderNumber} is on its way`;
    const intro =
      lang === 'de'
        ? 'gute Nachrichten: Dein Paket hat unser Lager verlassen.'
        : 'good news: your parcel has left our warehouse.';
    const tr = order.tracking || {};
    const trackLine = tr.number
      ? `${lang === 'de' ? 'Sendungsnummer' : 'Tracking number'}: ${tr.carrier ? `${tr.carrier} ` : ''}${tr.number}`
      : '';
    const html = layout({
      lang,
      siteUrl: p.siteUrl,
      title: subject,
      preheader: subject,
      bodyHtml: `<h1 style="font-size:24px;margin:0 0 12px">${esc(t.hello(order.customer.firstName))}</h1>
<p>${esc(intro)}</p>${trackLine ? `<p><strong>${esc(trackLine)}</strong></p>` : ''}
${button(tr.url || p.trackUrl, tr.url ? (lang === 'de' ? 'Sendung verfolgen' : 'Track parcel') : t.track)}
<p style="color:#53665a">${esc(t.questions)}</p>`,
      footerNote: esc(t.footer),
    });
    return {
      subject,
      html,
      text: [t.hello(order.customer.firstName), '', intro, trackLine, tr.url || p.trackUrl]
        .filter(Boolean)
        .join('\n'),
    };
  },

  order_status(p) {
    const { order, lang, status } = p;
    const t = T[lang];
    const label = statusLabel(status, lang);
    const subject = `${order.orderNumber}: ${label}`;
    const messages = {
      de: {
        cancelled:
          'deine Bestellung wurde storniert. Wenn du bereits bezahlt hast, erstatten wir den Betrag auf dein ursprüngliches Zahlungsmittel.',
        refunded:
          'wir haben deine Zahlung erstattet. Je nach Zahlungsart dauert es einige Werktage, bis der Betrag sichtbar ist.',
        payment_failed:
          'leider ist deine Zahlung nicht durchgegangen. Deine Bestellung wurde nicht abgeschlossen. Du kannst es jederzeit erneut versuchen.',
        delivered: 'dein Paket wurde zugestellt. Lass es dir schmecken!',
      },
      en: {
        cancelled:
          'your order has been cancelled. If you already paid, we will refund the amount to your original payment method.',
        refunded:
          'we have refunded your payment. Depending on the payment method it may take a few working days to appear.',
        payment_failed:
          'unfortunately your payment did not go through, so your order was not completed. You can try again at any time.',
        delivered: 'your parcel has been delivered. Enjoy!',
      },
    };
    const intro = messages[lang][status] || `${label}.`;
    const html = layout({
      lang,
      siteUrl: p.siteUrl,
      title: subject,
      preheader: subject,
      bodyHtml: `<h1 style="font-size:24px;margin:0 0 12px">${esc(t.hello(order.customer.firstName))}</h1>
<p>${esc(intro)}</p>${p.note ? `<p style="color:#53665a">${esc(p.note)}</p>` : ''}
${button(p.trackUrl, t.track)}<p style="color:#53665a">${esc(t.questions)}</p>`,
      footerNote: esc(t.footer),
    });
    return {
      subject,
      html,
      text: [t.hello(order.customer.firstName), '', intro, p.note, p.trackUrl]
        .filter(Boolean)
        .join('\n'),
    };
  },

  merchant_new_order(p) {
    const { order } = p;
    const lang = 'de';
    const country = COUNTRIES[order.country]?.name.de || order.country;
    const subject = `Neue Bestellung ${order.orderNumber}: ${formatMoney(order.amountPaid ?? order.total, 'de')} (${country})`;
    const html = layout({
      lang,
      siteUrl: p.siteUrl,
      title: subject,
      preheader: subject,
      bodyHtml: `<h1 style="font-size:22px;margin:0 0 12px">Neue bezahlte Bestellung</h1>
<p><strong>${esc(order.orderNumber)}</strong> von ${esc(order.customer.firstName)} ${esc(order.customer.lastName)}, ${esc(order.customer.email)}, ${esc(order.customer.phone)}</p>
${orderTable(order, lang)}
<p style="margin-top:18px"><strong>Lieferadresse</strong><br>${addressBlock(order.customer, lang)}</p>
${order.note ? `<p><strong>Notiz:</strong> ${esc(order.note)}</p>` : ''}
${button(p.adminUrl, 'Im Admin öffnen')}`,
      footerNote: 'Automatische Benachrichtigung aus dem Earthveda Shop.',
    });
    return { subject, html, text: `${subject}\n\n${orderText(order, 'de')}\n\n${p.adminUrl}` };
  },

  newsletter_confirm(p) {
    const { lang } = p;
    const subject =
      lang === 'de' ? 'Bitte bestätige deine Anmeldung' : 'Please confirm your subscription';
    const intro =
      lang === 'de'
        ? 'du hast dich für den Earthveda Newsletter angemeldet. Bitte bestätige deine E-Mail-Adresse, damit wir dir Neuigkeiten und Angebote schicken dürfen.'
        : 'you signed up for the Earthveda newsletter. Please confirm your email address so we can send you news and offers.';
    const ignore =
      lang === 'de'
        ? 'Wenn du dich nicht angemeldet hast, ignoriere diese E-Mail einfach. Ohne Bestätigung erhältst du keine weiteren Nachrichten.'
        : 'If you did not sign up, simply ignore this email. Without confirmation you will not hear from us again.';
    const label = lang === 'de' ? 'Anmeldung bestätigen' : 'Confirm subscription';
    const hello = lang === 'de' ? 'Hallo,' : 'Hi,';
    const html = layout({
      lang,
      siteUrl: p.siteUrl,
      title: subject,
      preheader: subject,
      bodyHtml: `<h1 style="font-size:24px;margin:0 0 12px">${hello}</h1><p>${esc(intro)}</p>${button(p.confirmUrl, label)}<p style="color:#53665a;font-size:13px">${esc(ignore)}</p>`,
      footerNote: esc(
        lang === 'de' ? 'Earthveda Essentials Newsletter' : 'Earthveda Essentials newsletter',
      ),
    });
    return {
      subject,
      html,
      text: `${hello}\n\n${intro}\n\n${label}: ${p.confirmUrl}\n\n${ignore}`,
    };
  },

  newsletter_welcome(p) {
    const { lang } = p;
    const subject = lang === 'de' ? 'Willkommen bei Earthveda!' : 'Welcome to Earthveda!';
    const intro =
      lang === 'de'
        ? 'schön, dass du dabei bist. Ab jetzt hörst du als Erstes von neuen Sorten und Angeboten.'
        : 'great to have you. From now on you will be first to hear about new flavours and offers.';
    const code = p.welcomeCode
      ? `<p style="background:#f6dc93;border-radius:10px;padding:14px 16px;font-size:16px">${esc(lang === 'de' ? 'Dein Willkommenscode' : 'Your welcome code')}: <strong style="letter-spacing:2px">${esc(p.welcomeCode)}</strong></p>`
      : '';
    const unsub = lang === 'de' ? 'Newsletter abbestellen' : 'Unsubscribe';
    const html = layout({
      lang,
      siteUrl: p.siteUrl,
      title: subject,
      preheader: subject,
      bodyHtml: `<h1 style="font-size:24px;margin:0 0 12px">${lang === 'de' ? 'Hallo,' : 'Hi,'}</h1><p>${esc(intro)}</p>${code}${button(p.shopUrl, lang === 'de' ? 'Jetzt entdecken' : 'Start shopping')}`,
      footerNote: `<a href="${esc(p.unsubscribeUrl)}" style="color:#53665a">${esc(unsub)}</a>`,
    });
    return {
      subject,
      html,
      text: `${intro}\n${p.welcomeCode ? `\nCode: ${p.welcomeCode}\n` : ''}\n${p.shopUrl}\n\n${unsub}: ${p.unsubscribeUrl}`,
      headers: {
        'List-Unsubscribe': `<${p.unsubscribeOneClickUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    };
  },

  withdrawal_receipt(p) {
    const { lang, w } = p;
    const subject =
      lang === 'de'
        ? `Eingangsbestätigung deiner Widerrufserklärung (${w.reference})`
        : `Acknowledgement of receipt of your cancellation (${w.reference})`;
    const received = formatDateTime(w.createdAt, lang);
    const rows =
      lang === 'de'
        ? [
            ['Eingegangen am', `${received} (Zeitzone Europe/Berlin)`],
            ['Referenz', w.reference],
            ['Name', w.name],
            ['Bestellnummer / Vertrag', w.orderNumber],
            ['E-Mail für diese Bestätigung', w.email],
            ['Umfang', w.scope || 'Gesamter Vertrag'],
          ]
        : [
            ['Received on', `${received} (time zone Europe/Berlin)`],
            ['Reference', w.reference],
            ['Name', w.name],
            ['Order number / contract', w.orderNumber],
            ['Email for this confirmation', w.email],
            ['Scope', w.scope || 'Entire contract'],
          ];
    const intro =
      lang === 'de'
        ? 'wir bestätigen den Eingang deiner über unsere Website abgegebenen Widerrufserklärung mit folgendem Inhalt:'
        : 'we confirm receipt of the cancellation declaration you submitted on our website, with the following content:';
    const declaration =
      lang === 'de'
        ? 'Erklärung: Hiermit widerrufe ich den oben genannten Vertrag.'
        : 'Declaration: I hereby withdraw from the contract stated above.';
    const next =
      lang === 'de'
        ? 'Wir melden uns mit den nächsten Schritten zur Rücksendung und Erstattung.'
        : 'We will be in touch with the next steps for the return and refund.';
    const html = layout({
      lang,
      siteUrl: p.siteUrl,
      title: subject,
      preheader: subject,
      bodyHtml: `<h1 style="font-size:22px;margin:0 0 12px">${lang === 'de' ? 'Hallo' : 'Hi'} ${esc(w.name)},</h1><p>${esc(intro)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;margin:14px 0">${rows.map(([k, val]) => `<tr><td style="padding:4px 16px 4px 0;color:#53665a;vertical-align:top">${esc(k)}</td><td style="padding:4px 0"><strong>${esc(val)}</strong></td></tr>`).join('')}</table>
<p>${esc(declaration)}</p><p>${esc(next)}</p>`,
      footerNote: esc(
        lang === 'de'
          ? 'Diese Eingangsbestätigung wurde automatisch erstellt.'
          : 'This acknowledgement was generated automatically.',
      ),
    });
    return {
      subject,
      html,
      text: [intro, '', ...rows.map(([k, val]) => `${k}: ${val}`), '', declaration, next].join(
        '\n',
      ),
    };
  },

  merchant_withdrawal(p) {
    const { w } = p;
    const subject = `Widerruf eingegangen: ${w.orderNumber} (${w.reference})`;
    const text = `Widerruf über die Website\n\nReferenz: ${w.reference}\nEingang: ${formatDateTime(w.createdAt, 'de')}\nName: ${w.name}\nE-Mail: ${w.email}\nBestellung: ${w.orderNumber}\nUmfang: ${w.scope || 'Gesamter Vertrag'}\n\n${p.adminUrl}`;
    return {
      subject,
      text,
      html: layout({
        lang: 'de',
        siteUrl: p.siteUrl,
        title: subject,
        preheader: subject,
        bodyHtml: `<pre style="white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif">${esc(text)}</pre>`,
        footerNote: 'Automatische Benachrichtigung aus dem Earthveda Shop.',
      }),
    };
  },
};

export function renderEmail(template, payload) {
  const fn = TEMPLATES[template];
  if (!fn) throw new Error(`Unknown email template ${template}`);
  return fn(payload);
}

/**
 * WhatsApp template bodies. Template names and their approved text are listed
 * in README → "WhatsApp templates". Parameters may not contain line breaks.
 */
const flat = (s) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900);
export function buildWhatsAppTemplate(template, payload) {
  const { order, lang = 'de' } = payload;
  const params = (...values) => [
    { type: 'body', parameters: values.map((v) => ({ type: 'text', text: flat(v) || '-' })) },
  ];
  switch (template) {
    case 'order_confirmation':
      return {
        name: 'ev_order_confirmation',
        language: { code: lang === 'de' ? 'de' : 'en' },
        components: params(
          order.customer.firstName,
          order.orderNumber,
          formatMoney(order.amountPaid ?? order.total, lang),
        ),
      };
    case 'order_shipped':
      return {
        name: 'ev_order_shipped',
        language: { code: lang === 'de' ? 'de' : 'en' },
        components: params(
          order.customer.firstName,
          order.orderNumber,
          order.tracking?.url || order.tracking?.number || payload.trackUrl,
        ),
      };
    case 'merchant_new_order':
      return {
        name: 'ev_new_order_alert',
        language: { code: 'de' },
        components: params(
          order.orderNumber,
          formatMoney(order.amountPaid ?? order.total, 'de'),
          `${order.customer.firstName} ${order.customer.lastName}, ${order.customer.city} (${order.country})`,
          order.lines.map((l) => `${l.quantity}x ${l.name}`).join('; '),
        ),
      };
    default:
      return null;
  }
}
