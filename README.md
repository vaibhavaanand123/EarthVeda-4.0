# EarthVeda Essentials 6.1.1

React/Vite storefront, Node 24 API, MongoDB inventory/orders, Stripe hosted checkout, admin and notification worker. German and English storefronts are retained. The original UI, CSS, fonts and product images are preserved; this revision focuses on pricing and reliability.

**Plant Protein is €14.99 per unit**, including Mango, Royal Cream and Chocolate. Foxnuts remain €2.99 per pack. The 8-pack is €23.92; the 16-pack is €47.84. All amounts are EUR, including UK orders. Delivery is separate: Germany €4.99, UK €11.99.

Start with [START_HERE.md](START_HERE.md). Read [the release and launch guide](docs/RELEASE_6_1_1.md) for the architecture, changes, database price update, deployment sequence, verification and remaining configuration.

## Run the storefront locally

Use Node 24:

```bash
npm ci
npm run dev
```

The default mode is a standalone preview. It uses the same initial product prices and cart calculations, but does not create orders, collect payments or submit newsletter details. Public preview pages remain noindex. Existing product imagery and bilingual routes are preserved.

## Verify

```bash
npm run check
npm run test:integration
npm run test:deployment
npm audit --omit=dev
```

`check` runs lint, formatting, 50 unit/business tests, 11 DOM interaction tests and a preview production build. Integration runs 16 tests against a disposable MongoDB replica set; its first run downloads MongoDB. For an existing **disposable** replica set, supply `TEST_MONGODB_URI`. Never use production database access for integration tests. Deployment tests exercise release and rollback paths with fake external services.

## Run actual commerce

Use the retained Node/Docker hosting architecture. A standalone Vercel static deployment is a storefront demo; it does not host the Node API, MongoDB or worker.

1. Configure MongoDB, Stripe, email, HTTPS and admin MFA using `.env.production.example` and the linked launch guide.
2. Initialize schema/seed and complete merchant, food-label and inventory records. Production seed products are drafts with zero stock.
3. Update an existing catalogue to €14.99 with the supplied price command. New seeds already use the new price.
4. Build connected mode, run launch checks, and verify payments in staging before switching to live credentials.

```bash
npm run build:connected
# Uses the configured database. First invocation is a read-only price report.
npm run catalog:price-protein
npm run catalog:price-protein -- --apply
npm run launch:check
npm start
# Run the notification/reconciliation worker in a separate process.
npm run worker
```

These Node commands load `.env` when it exists. On a production host, inject the production environment or use the supplied Docker Compose environment file. The server refuses to start in production with a preview frontend build. Do not serve `dist/` alone to operate live commerce.

## Source map

| Area | Files |
| --- | --- |
| Original homepage and discovery | `src/pages/Home.jsx`, `src/components/EditorialHero.jsx`, `src/components/DiscoverySection.jsx` |
| Product discovery and details | `src/pages/Shop.jsx`, `src/pages/Product.jsx` |
| Original brand styling | `src/styles/` (unchanged) |
| Cart and exact pricing | `src/lib/cart.js`, `shared/pricing.js` |
| Initial range prices | `shared/catalog.js`, `shared/seed.js` |
| Existing database pricing update | `server/scripts/priceProtein.js`, `server/services/proteinPriceMigration.js` |
| Connected checkout and orders | `src/pages/ConnectedCheckout.jsx`, `server/services/orderService.js` |
| Payments and refunds | `server/payments/`, `server/worker.js` |
| Publication and configuration | `server/services/catalogService.js`, `server/config.js`, `server/scripts/launchCheck.js` |
| Admin | `src/admin/`, `server/http/routes/admin.js` |
| Deployment | `Dockerfile`, `compose.production.yaml`, `deploy/` |

No production credentials or fabricated product-label facts are included. Existing API and operational documentation is retained; the 6.1.1 release guide takes precedence for this release.
