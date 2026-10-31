# Payments, email and WhatsApp

## Choose the merchant setup before live activation

The application chooses a merchant profile by the **delivery country validated by the server**. It does not infer legal ownership, bank eligibility or tax treatment. Language is independent of merchant profile.

| Setup | Environment | Hosted-checkout account | Webhook URL |
| --- | --- | --- | --- |
| One merchant account | `PAYMENT_ACCOUNT_MODE=single` | `STRIPE_SECRET_KEY` | `/api/webhooks/stripe` |
| Approved German merchant profile | `PAYMENT_ACCOUNT_MODE=per_market`, delivery DE | `STRIPE_DE_SECRET_KEY` | `/api/webhooks/stripe/DE` |
| Approved UK merchant profile | `PAYMENT_ACCOUNT_MODE=per_market`, delivery GB | `STRIPE_GB_SECRET_KEY` | `/api/webhooks/stripe/GB` |

For your requested German bank / UK bank arrangement, first confirm with Stripe that your business entities/accounts and bank accounts are eligible. Configure the bank accounts in each merchant dashboard. The code stores account-profile IDs, not your bank-account credentials, and it keeps that profile fixed for every later payment lookup/refund.

This release exposes one shared business/legal configuration. If the DE and GB accounts belong to different sellers, add and review per-market seller disclosures, terms, invoices and order snapshots before live activation; account routing alone does not implement that legal separation.

If you have one legal entity/account, a provider's multiple settlement-currency bank settings may be sufficient, but they do not automatically implement “route by customer country.” Do not open an account with inaccurate business details. Stripe Connect is a separate architecture for platforms/connected merchants; this release does not implement Connect.

**Charging currency and payout destination are different settings.** v5 prices remain EUR for DE and GB. A UK account may have conversion/settlement implications. Confirm eligible settlement currencies, fees and bank accounts before launch. A GBP store needs an explicit GBP price book, order/refund/report currency support and tested rounding; never label a EUR amount as GBP.

## Stripe test setup

1. In each approved Stripe account, use test mode/sandbox API keys.
2. Set `PAYMENT_PROVIDER=stripe`, `PAYMENT_MODE=test` and the selected account mode.
3. Fill server-only secret key fields and webhook secret fields. Production validation checks that API key prefixes match the selected mode.
4. Configure these events for each profile:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
charge.refunded
```

The current card-only policy usually does not need the async checkout events, but handlers recognize them without treating an unpaid completion as paid.

5. Use the correct endpoint's signing secret. A secret from the Dashboard endpoint and one from Stripe CLI forwarding are different.
6. For one local account, install [Stripe CLI](https://docs.stripe.com/stripe-cli), authenticate the intended test account and forward:

```powershell
stripe listen --forward-to localhost:8787/api/webhooks/stripe
```

7. For market routing, forward the German test account to:

```powershell
stripe listen --forward-to localhost:8787/api/webhooks/stripe/DE
```

Use another authenticated CLI configuration/process for the UK test account:

```powershell
stripe listen --forward-to localhost:8787/api/webhooks/stripe/GB
```

Check account identity before forwarding. Paste each listener's `whsec_...` into its matching environment field and restart the API/worker.

8. Complete a real app checkout with Stripe's test cards from [the testing guide](https://docs.stripe.com/testing). Generic CLI-generated checkout events do not contain your application order metadata and cannot prove the app integration works.
9. Test SCA, decline, duplicate delivery, payment mismatch, account mismatch, expired holds, worker restart, partial refund and full refund. Verify both account dashboards.

Card checkout explicitly sets `payment_method_types: ['card']`. Eligible Apple Pay/Google Pay availability depends on provider/device/account settings. PayPal, Klarna and SEPA are not implemented/enabled. Do not promise them in marketing.

The application uses the server's order total and disallows promotion codes at checkout. The old welcome-code copy/configuration does not implement a discount engine. Leave `newsletter.welcomeCode` empty until you implement and test real server-side promotion rules.

## Live payment activation

1. Finish staging tests, verify food/tax/legal information, approve the merchant setup and verify payout bank accounts.
2. Configure each live HTTPS webhook endpoint and copy its live signing secret.
3. Change `PAYMENT_MODE=live` and use matching `sk_live_...`/approved restricted keys. Keep all keys on the server.
4. Restart both API and worker; verify configuration/readiness and a low-value real order/refund for every live profile.
5. Reconcile successful payments, successful refunds and bank payouts in the matching account. Customer success redirects are not trusted payment evidence.
6. Use provider-hosted card entry. Review the merchant's PCI responsibilities with the provider; hosted checkout alone does not certify your business.
7. Rotate keys when staff/access changes or exposure is suspected. Keep the MFA encryption application secret stable until you run a deliberate secret re-encryption plan.

## SMTP email

Local development uses Mailpit at SMTP port 1025 and UI port 8025. It catches messages locally and does not deliver to real customers.

For staging/production, use a transactional SMTP service with a verified sender domain. This code is provider-independent; choose a service with appropriate deliverability, region, contract and retention options for your business.

```dotenv
SMTP_URL=smtps://USERNAME:URL_ENCODED_PASSWORD@smtp.YOUR_PROVIDER:465
MAIL_FROM="Earthveda <orders@your-domain.com>"
MAIL_REPLY_TO=support@your-domain.com
```

URL-encode special characters in username/password. Use TLS; do not disable certificate verification. Configure SPF and DKIM with the provider, then a reviewed DMARC policy. Test inbox placement and bounce handling. Do not use a personal email password as a production application credential.

The outbox stores a snapshot for order confirmation, shipment, status, newsletter confirmation/welcome and withdrawal acknowledgement. The worker retries transient failures with backoff, stops on permanent errors, and exposes failed/skipped messages for admin review. Configure the worker's environment, not only the API's.

`sent` means SMTP accepted the message; it is not proof of inbox delivery. This release does not consume a provider's delivery/bounce webhooks. Add those before requiring automated bounce suppression/reporting.

SMTP connections have bounded connection/greeting/socket timeouts. Logs do not print raw provider error messages that might contain tokens/customer data. Use the provider dashboard to investigate a generic failed delivery.

Newsletter signup records consent and uses a 72-hour pending confirmation window. Confirmation and the welcome outbox record commit together. Keep order notifications transactional; do not silently opt buyers into marketing.

## WhatsApp Business Cloud API

1. Set up Meta Business and a WhatsApp Business Account; complete required account/phone verification.
2. Register the sending phone number and record the **phone number ID**, which differs from the human phone number.
3. Create a suitable system-user access token with the minimum needed permissions; keep it server-only.
4. Verify the currently supported Graph API version for your account. The configuration starts at `v23.0`; an API version is a deployment setting that needs lifecycle review.
5. Set:

```dotenv
WHATSAPP_TOKEN=your_private_system_user_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_API_VERSION=v23.0
```

6. Create the exact approved template names and language variants used by `server/notifications/templates.js`:

| Template | Languages | Body parameter order |
| --- | --- | --- |
| `ev_order_confirmation` | `de`, `en` | first name, order number, formatted amount |
| `ev_order_shipped` | `de`, `en` | first name, order number, tracking URL/number |
| `ev_new_order_alert` | `de` | order number, formatted amount, customer name/city/country, item summary |

**Check the actual `buildWhatsAppTemplate` function before submitting templates.** The provider requires name, language, component structure and parameter count to match exactly. This project does not submit/approve templates on your behalf.

7. Enable customer WhatsApp order messages only through the explicit checkout opt-in. Merchant WhatsApp recipients are configured by the owner under notification settings and should be approved internal recipients.
8. Send a staging order to an allowed, opted-in test recipient. Inspect the Meta dashboard if the job fails.
9. Plan token rotation and API-version upgrades. An API-accepted message is not proof it was read/delivered; delivery receipt ingestion is not implemented in this release.

## London delivery coverage

`GB` means the UK market; it does not mean London only. `GB_POSTCODE_AREAS` is a comma-separated allow-list of **exact outward postcode codes**, for example `SW1A,EC1V`. These are examples, not a complete London definition.

Blank permits all valid GB-format postcodes. Before a London-only launch, supply your actual approved service-area list, test boundary addresses, and align the shipping page with it. The server enforces the list before creating a new checkout. Pricing in v5 is €11.99 UK shipping; confirm your real delivery price/policy separately.

## Primary references

- [Stripe payouts and settlement currencies](https://docs.stripe.com/payouts)
- [Stripe webhook handling](https://docs.stripe.com/webhooks)
- [Stripe refunds](https://docs.stripe.com/refunds)
- [Stripe testing](https://docs.stripe.com/testing)
- [Nodemailer SMTP](https://nodemailer.com/smtp/)
- [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/)
- [Meta message templates](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/)
