import nodemailer from 'nodemailer';

/**
 * Delivery channels. Each implements `send(message)` and throws on failure.
 * Throw an error with `permanent = true` for failures a retry cannot fix
 * (bad recipient, rejected template), so the dispatcher stops retrying.
 */

export class ChannelError extends Error {
  constructor(message, { permanent = false } = {}) {
    super(message);
    this.name = 'ChannelError';
    this.permanent = permanent;
  }
}

/** SMTP email (works with any provider: Postmark, Brevo, SES, Mailgun, IONOS, Google Workspace...). */
export function createEmailChannel({ smtpUrl, from, replyTo, render, transport }) {
  const transporter =
    transport ??
    (smtpUrl
      ? nodemailer.createTransport({
          ...nodemailer.createTransport(smtpUrl).options,
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 30000,
        })
      : null);
  return {
    name: 'email',
    configured: Boolean(transporter && from),
    async send({ recipient, template, payload }) {
      const message = render(template, payload);
      try {
        await transporter.sendMail({
          from,
          to: recipient,
          replyTo: replyTo || undefined,
          subject: message.subject,
          html: message.html,
          text: message.text,
          headers: message.headers,
        });
      } catch (error) {
        // 5xx SMTP responses are permanent (unknown mailbox, rejected content).
        const permanent = Number(error?.responseCode) >= 500 && Number(error?.responseCode) < 600;
        throw new ChannelError(error?.message || 'SMTP send failed', { permanent });
      }
    },
  };
}

/**
 * WhatsApp Business Cloud API (Meta). Business-initiated messages must use
 * pre-approved templates; see README → "WhatsApp templates".
 */
export function createWhatsAppChannel({
  token,
  phoneNumberId,
  apiVersion,
  buildTemplate,
  fetchImpl = fetch,
}) {
  return {
    name: 'whatsapp',
    configured: Boolean(token && phoneNumberId),
    async send({ recipient, template, payload }) {
      const body = buildTemplate(template, payload);
      if (!body)
        throw new ChannelError(`No WhatsApp template for ${template}`, { permanent: true });
      let response;
      try {
        response = await fetchImpl(
          `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: recipient.replace(/^\+/, ''),
              type: 'template',
              template: body,
            }),
            signal: AbortSignal.timeout(10_000),
          },
        );
      } catch (error) {
        throw new ChannelError(`WhatsApp request failed: ${error.message}`);
      }
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new ChannelError(`WhatsApp API ${response.status}: ${detail.slice(0, 300)}`, {
          permanent: response.status >= 400 && response.status < 500 && response.status !== 429,
        });
      }
    },
  };
}

/** Generic JSON webhook (Slack workflow, Zapier, Make, n8n...). */
export function createWebhookChannel({ url, fetchImpl = fetch }) {
  return {
    name: 'webhook',
    configured: Boolean(url),
    async send({ template, payload }) {
      let response;
      try {
        response = await fetchImpl(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: template, data: payload }),
          signal: AbortSignal.timeout(8_000),
        });
      } catch (error) {
        throw new ChannelError(`Webhook failed: ${error.message}`);
      }
      if (!response.ok) throw new ChannelError(`Webhook responded ${response.status}`);
    },
  };
}
