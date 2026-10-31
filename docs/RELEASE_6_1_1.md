# EarthVeda 6.1.1: pricing, reliability and launch

Prepared 31 October 2026. This revision follows the instruction to keep the original UI. It removes the additional presentation changes from 6.1 while retaining the pricing, payment, inventory and launch safeguards. It has not been deployed to a merchant production account.

## Price requirement

The supplied application charges EUR. The requested 14.99 is implemented as **€14.99 per sellable unit**, not per scoop or serving. No serving size or product weight has been invented.

| Product | Initial gross unit price |
| --- | --- |
| Mango Plant Protein | €14.99 |
| Royal Cream Plant Protein | €14.99 |
| Chocolate Plant Protein | €14.99 |
| Foxnuts, all flavours | €2.99 |
| Foxnut box of 8 | €23.92 |
| Foxnut box of 16 | €47.84 |

Germany delivery is €4.99; UK delivery is €11.99. UK checkout also charges EUR. Example: two protein units are €29.98; with Germany delivery the total is €34.97; with UK delivery it is €41.97. Boxes continue to contain foxnuts only.

`CATALOG_PRICES` in `shared/catalog.js` is the seed-price source. Preview products inherit those prices instead of overriding every product to 299 cents. In a connected deployment, database catalogue prices remain authoritative and editable by administrators.

## End-to-end architecture

| Layer | Responsibility | Release finding/action |
| --- | --- | --- |
| React/Vite | DE/EN pages, discovery, wishlist, cart and checkout | Restored the original homepage, product cards, navigation and product-page layout. Original styles and images are unchanged. |
| StoreContext | Local preview data or connected catalogue API | Removed the blanket preview price override. |
| CartContext and shared pricing | Saved quantities, delivery country and integer-cent totals | Added market-aware purchase controls, aggregate stock checks, readable product names and removable missing products. |
| Node API / Zod | Input validation, catalogue, admin and order routes | Updated Zod to the patched 4.x release and adapted custom terms validation. |
| Order service | Requotes against the database; reserves stock and snapshots order prices | Rejects a stale displayed total before reserving stock or opening a payment session. |
| MongoDB | Products, inventory, orders, sessions, audit and durable outbox | Retained replica-set transactions and added an explicit, audited protein-price migration. |
| Stripe adapter | Hosted card checkout and signed webhook processing | Retained exact amount/currency/account validation, replay handling and refund logic. |
| Worker | Notifications, refunds and reconciliation | Retained separately supervised worker and heartbeat checks. |
| Node HTML and Vite | Page metadata, assets and frontend mode | Fixed connected HTML retaining preview noindex metadata; added a build-mode marker and production startup guard. |
| Docker/Caddy/release scripts | TLS, API, worker, immutable image release and rollback | Retained full-stack deployment and verified its simulated failure/rollback paths. |

The browser sends product IDs and quantities. The server loads current prices, computes integer-cent totals, creates an immutable order and reserves inventory transactionally. Stripe receives the server's order amounts. A signed payment event must match that order before stock is consumed and confirmations are queued. The redirect page alone cannot mark an order paid.

The current frontend sends `expectedTotal` for explicit confirmation when prices or delivery charges change. It is optional in the API for rolling compatibility with older clients; all amounts are always recomputed by the server. Already-created pending payment sessions retain their frozen checkout price, as do historical paid orders.

## UI scope

The original storefront remains in place. All eight CSS files, including the admin stylesheet, and all fourteen supplied product images match the first uploaded source byte for byte. The additional 6.1 Plant Protein feature section, custom delivery selector, product-flavour strip, extra shop search/availability controls, product-card descriptions and `launch.css` layer have been removed. The existing header search, shop filters, product links, wishlist and box quiz remain.

Visible changes are limited to price correctness and feedback within the existing components:

- Protein products show €14.99 and a small per-unit note using the existing price styles.
- Basket lines display translated product names and the protein unit price. Quantity totals and existing mobile purchase controls use the same amount.
- Availability follows the selected delivery country. Missing or insufficient-stock products show a recoverable state and block checkout.
- Product quantities reset when an existing related-product link opens another product. Delivery estimates use the country already selected in the cart.
- The final connected-checkout action includes the amount being confirmed. A server-detected price change requests confirmation of a fresh total.
- New admin protein products default to €14.99 when the untouched range default is changed; deliberately entered prices and existing catalogue records remain editable.

Functional admin/lint fixes from 6.1 are retained. No extra fonts, themes, imagery, marketing sections, animations, fake reviews or fabricated product claims were added.

## Existing database price update

Changing seeds does not overwrite an existing database. The new command explicitly updates nonarchived products in the `protein` range to 1499 cents.

1. Use your intended environment and take a verified backup/snapshot before the release.
2. Run the dry report and review the matched SKUs:

```bash
npm run catalog:price-protein
```

3. Apply the update:

```bash
npm run catalog:price-protein -- --apply
```

The apply operation uses one MongoDB transaction, requires each previously read price/version to match, increments product versions, and records audit entries. Concurrent writes cause a conflict/retry rather than a lost update. Repeating the command makes no further changes once prices are correct. It does not change order snapshots, payment amounts, foxnuts, archived products, inventory or product descriptions.

The API cache refreshes within about three seconds; the storefront HTTP cache is short-lived. Restarting the API or reloading fresh catalogue data accelerates visibility. A browser using an old displayed total is asked to review the current total at checkout. Do not change prices in Stripe separately: the adapter builds payment line items from the server's order snapshot.

## Launch sequence

### 1. Choose the correct hosting model

Use the retained Node 24 + Docker/Caddy deployment with a MongoDB replica set or Atlas and a separate worker. The existing Vercel configuration hosts a standalone preview. It is not a deployment of the full commerce backend. No production host, domain-account access, database credentials, Stripe credentials or SMTP credentials were supplied in this task, so no live deployment was attempted.

For local backend development use `.env.example` and the existing `compose.yaml`. For production use `.env.production.example`, `compose.production.yaml` and [CI_CD_DEPLOYMENT_BASH.md](CI_CD_DEPLOYMENT_BASH.md). Do not expose MongoDB publicly or put server secrets into `VITE_*` variables.

### 2. Supply service configuration

Configure the real HTTPS `PUBLIC_SITE_URL`, authenticated TLS MongoDB URI, a private random `APP_SECRET`, Stripe account/webhook secrets, authenticated SMTP sender and `REQUIRE_ADMIN_MFA=true`. Start with Stripe test mode in staging. Production validation rejects mock payments, weak secrets and incomplete required configuration.

All new Node commands load `.env` when present. In production inject the actual environment or run them inside the Compose service using `.env.production`; merely copying the example to `.env.production` does not make local Node commands load it automatically.

### 3. Initialize and complete business data

Initialize the database using the supplied setup command in the configured environment:

```bash
npm run db:setup -- --seed
npm run admin:create
```

Production seed products are inactive drafts with zero inventory. In the admin, complete merchant/contact details, verified product weights, ingredients, allergen declarations, storage and nutrition, and actual market inventory before publishing products. Review the retained legal/food pages for the business and market setup. The presence of template pages is not a compliance review. Review seeded descriptive claims against actual packaging as part of product approval.

For an older database, run the price migration above. The migration does not bypass food-publication validation. New-product admin defaults also use the shared range prices; changing the default does not overwrite existing catalogue records.

### 4. Build and run preflight

```bash
npm ci
npm run check
npm run test:integration
npm run test:deployment
npm audit --omit=dev
npm run build:connected
npm run launch:check
```

`check` produces a preview build; `build:connected` must run afterwards for a live release. Docker already defaults to connected mode and rebuilds the frontend. The included `dist/` is a connected build, but production should rebuild from the supplied lockfile in CI.

`launch:check` is read-only. It requires production environment validation, a connected build, initialized schema, core merchant details, published products, protein prices of 1499 cents, essential food information and inventory for products marked available. A passing result is a configuration check, not a successful payment or a full legal/security certification.

The production Node API refuses to start with a preview build or missing build metadata. Keep preview deployments private/noindex until approved; connected product pages become indexable while checkout, admin, order and missing pages remain noindex.

### 5. Exercise the real services in staging

Start the API and a separately supervised worker. Register the correct Stripe webhook URL using the retained payments guide. Complete a test payment, replay its webhook, verify one order/one stock commitment, confirm the email, inspect the worker heartbeat, and test a refund and a failed payment. Check both market delivery flows. The integrated tests use a simulated payment provider and SMTP transport; they do not prove live Stripe, DNS, TLS, inbox delivery or WhatsApp acceptance.

Then select live Stripe credentials and mode on the intended production account. Deploy a verified immutable image using the supplied release process. Configure domain/DNS, monitoring and backup restore tests. Test the actual target mobile devices before opening sales; this task's real-browser walkthrough used a desktop browser. Confirm available payment methods in the live Stripe account; the connected adapter currently supports cards and eligible card wallets, not the preview's illustrative PayPal/Klarna choices.

## Verification performed

See [VERIFICATION.md](VERIFICATION.md) for recorded results and limitations. This revision specifically checks €14.99 display in the original German/English listings, existing product navigation, admin defaults, cart arithmetic and the retained server-side safeguards. Unit/business and DOM suites, database integration, deployment simulations, preview and connected builds, and dependency audits were run during this task. No production resources were mutated.

## Primary implementation references

- Stripe: https://docs.stripe.com/payments/checkout/fulfillment
- Stripe webhook signatures: https://docs.stripe.com/webhooks
- W3C target size guidance: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- W3C visible keyboard focus: https://www.w3.org/WAI/WCAG22/Understanding/focus-visible
- Zod 4 migration: https://zod.dev/v4/changelog

These informed the implementation choices; no claim of complete WCAG conformance or independent security certification is made.
