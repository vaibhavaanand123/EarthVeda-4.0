# API reference

All money is integer EUR cents. All input is validated by Zod. Examples are schemas/field descriptions; use the UI or a test HTTP client with private credentials to exercise them.

Errors use `{ error: { code, message, fields?, details? } }`. Validation errors are 400; authentication 401; authorization/CSRF 403; absent resources 404; concurrency/idempotency conflicts 409; throttling 429. Request IDs are returned in `X-Request-Id`. Internal errors do not expose stack traces.

## Public endpoints

| Method/path | Input | Response |
| --- | --- | --- |
| GET `/api/health` | None | Process health/time |
| GET `/api/ready` | None | Database/schema readiness |
| GET `/api/storefront` | None | Published products, stock by market, bundles, shipping, story, business |
| POST `/api/quote` | country, lang, items, boxes | `{quote}` with totals/lines/tax |
| POST `/api/checkout` | Basket, customer, terms and consent; UUID `Idempotency-Key` header | 201 `{orderNumber,status,paymentUrl}` |
| GET `/api/orders/:number/status` | `?session_id=...` | `{order}` with limited customer view |
| POST `/api/orders/lookup` | orderNumber, email | `{order}` with limited customer view |
| POST `/api/newsletter/subscribe` | email, lang, source, empty website honeypot | 202 `{ok:true}` |
| POST `/api/newsletter/confirm` | token | `{ok:true}` |
| POST `/api/newsletter/unsubscribe` | token in body or query | `{ok:true}` |
| POST `/api/withdrawals` | name, orderNumber, email, scope, lang | 201 receipt reference/date |
| POST `/api/dev/mock-payment` | sessionId, outcome (`success`, `fail`, `expired`) | Development/test only |

The order lookup requires both order number and email and returns neither full address/contact data nor internal notes. It is a convenience guest lookup; a signed expiring email link would provide stronger possession verification if that is required for future customer-account features.

Checkout shape:

```javascript
{
  country: 'DE', lang: 'de',
  items: [{ productId: 'peri-peri', quantity: 2 }],
  boxes: [{bundleId:'box-8',quantity:1,picks:[
    {productId:'cream-onion',quantity:2},
    {productId:'peri-peri',quantity:2},
    {productId:'four-cheese',quantity:2},
    {productId:'butter-chicken',quantity:2}
  ]}],
  customer: {
    email:'customer@example.de',firstName:'Anna',lastName:'Schmidt',
    phone:'+4915123456789',street:'Example street 1',
    postalCode:'10115',city:'Berlin',company:'',address2:''
  },
  note:'',acceptTerms:true,whatsappOptIn:false,newsletterOptIn:false,website:''
}
```

The server ignores client prices because no client-price field exists in the validated schema. The same idempotency key with different normalized checkout details returns a conflict. Stock is reserved only for an order, not for a quote.

## Webhooks

POST `/api/webhooks/stripe` for one account, or `/api/webhooks/stripe/DE` and `/api/webhooks/stripe/GB` for per-market profiles. Send the exact raw body and `Stripe-Signature`. These endpoints are mounted before the JSON parser. Each endpoint validates with its configured profile secret; a cross-profile event cannot pay an order.

## Admin authentication

Use `X-EV-Admin: 1` on mutating requests and the HttpOnly `ev_admin` session cookie. Browser requests must originate from the configured site or explicit development origin. Cookies are SameSite=Strict and Secure in production. No bearer token is stored in browser localStorage.

| Method/path under `/api/admin` | Input / purpose |
| --- | --- |
| POST `/login` | email, password, otp when enabled |
| POST `/logout` | Revoke session |
| GET `/me` | Public user fields and MFA enrollment state |
| POST `/me/password` | currentPassword, newPassword; revokes sessions |
| POST `/me/mfa/setup` | password; returns temporary private setup secret/URI |
| POST `/me/mfa/confirm` | otp; enables MFA, revokes sessions |

Production users without MFA have enrollment-only sessions. The setup secret is shown only during enrollment and expires after ten minutes. Recovery is an offline operator procedure, not an unauthenticated HTTP endpoint.

## Admin catalogue/inventory

| Method/path under `/api/admin` | Input / response |
| --- | --- |
| GET `/products` | `{products}` including drafts/archive/version |
| GET `/products/:id` | `{product}` |
| POST `/products` | Product schema; blank SKU generates one; `{product}` |
| PUT `/products/:id` | Full product fields + version; `{product}` |
| PATCH `/products/:id` | active/inStock + version; `{product}` |
| POST `/products/:id/archive` | Hide without deleting order history |
| POST `/products/:id/restore` | Restore as draft |
| POST `/skus` | range `foxnuts`/`protein`; `{sku}` |
| POST `/uploads` | Raw JPEG/PNG/WebP binary, <3 MB; `{url,bytes}` |
| GET `/inventory` | `{inventory,products}` |
| POST `/inventory/adjust` | productId, country, integer nonzero delta, reason, UUID operationId |

A product includes slug/SKU/range/image/accent/price/market VAT/net weight, flags, sortOrder, DE/EN text and optional nutrition table. `server/services/schemas.js` is the authoritative validation definition. Production publication requires complete food information. New products have zero market stock.

Stock adjustment retries retain the same operationId. Reusing it with different quantity/reason conflicts. Negative adjustments cannot consume reserved stock.

## Admin orders, messages and owners

| Method/path under `/api/admin` | Purpose / privilege |
| --- | --- |
| GET `/summary` | 30-day paid-order revenue summary |
| GET `/orders/feed?since=...` | Recent paid orders for admin alert |
| GET `/orders` | Filter/search/paginate (limit ≤200) |
| GET `/orders.csv` | Owner export |
| GET `/orders/:number` | Full internal order |
| PATCH `/orders/:number/status` | Allowed fulfilment transition, optional note/notifyCustomer |
| PUT `/orders/:number/tracking` | carrier, number, HTTPS url |
| PUT `/orders/:number/note` | Internal note |
| POST `/orders/:number/refund` | Owner; optional amount/reason; queues request, does not instantly confirm money |
| GET `/notifications` | Recent notification metadata |
| POST `/notifications/:id/retry` | Retry failed/skipped message |
| GET `/jobs` | Owner; recent refund job metadata |
| POST `/jobs/:id/retry` | Owner; retry failed job after investigation |
| GET `/settings` | Current business/catalogue settings |
| PUT `/settings/:key` | Owner; validated shipping/bundles/story/business/notifications/newsletter settings |
| GET `/subscribers`, GET `/subscribers.csv`, DELETE `/subscribers/:id` | Owner consent list/export/delete |
| GET `/withdrawals`, PATCH `/withdrawals/:id` | View/record handled state |
| GET/POST `/users`, PUT `/users/:id`, POST `/users/:id/password` | Owner team management |
| GET `/audit` | Owner audit entries |

Staff can manage catalogue, stock and order workflow. Staff cannot manage owners/settings, export orders/subscribers, or issue refunds. The UI is a convenience; the API enforces authorization. Notification/job IDs are UUIDs; subscriber/withdrawal IDs use numeric counters.

Revenue is paid amount minus confirmed refunds, grouped in the single supported currency. The current summary is not an accounting/VAT filing system. CSV exports escape formula-leading values; nevertheless restrict who receives personal-data exports.
