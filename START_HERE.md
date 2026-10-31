# Start here

Your updated project is in this folder. The release includes source, tests, deployment configuration, and a compiled **connected** frontend in `dist/`.

- **Price:** all three Plant Protein flavours are €14.99 per unit, including VAT and excluding delivery. Existing database catalogues require the price update command.
- **UI:** original homepage, cards, product pages, navigation, fonts, images and CSS preserved. Only price labels and necessary purchase feedback have changed.
- **Reliability:** server-side pricing, stale-price confirmation, market stock checks, transactional inventory, signed payment webhooks, a safe database price migration and a production build guard.

To see the storefront:

```bash
npm ci
npm run dev
```

Open the address printed by Vite. German is at `/`; English is at `/en`. This local mode is a payment-free preview.

To launch real sales, follow [docs/RELEASE_6_1_1.md](docs/RELEASE_6_1_1.md). You still need your hosting/domain, database, Stripe and email configuration, verified food information, merchant details and actual inventory. The code cannot create these business records or service credentials for you.

Do not upload `dist/` to a static host and assume checkout is live. Use the supplied Node/Docker deployment with its API and worker. The production server checks that it has a connected build.
