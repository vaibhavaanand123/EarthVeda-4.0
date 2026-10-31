# EarthVeda 6.1.1 verification

Run date: 31 October 2026. Node 24.22.1; npm 11.9.0. This records verification of the supplied source and the changes in this release, not a live merchant deployment.

| Check | Result |
| --- | --- |
| ESLint | Pass |
| Prettier source/config check | Pass |
| Unit, pricing, security and business tests | 50 passed |
| React DOM interaction tests | 11 passed |
| Real MongoDB replica-set and HTTP integration tests | 16 passed |
| Simulated deployment/rollback/SSH scenarios | 10 passed |
| Vite preview production build | Pass |
| Vite connected production build | Pass |
| Production npm dependency audit | 0 known vulnerabilities |
| Full npm dependency audit | 0 high/critical; 6 moderate findings in development tooling |

The development findings trace to minimatch and ESLint's dependency chain. npm reports no compatible automatic fix. They are not present in the runtime dependency audit. Review them again before future releases; this report is a point-in-time result, not a promise that future advisories will remain clear.

## Requirement coverage

- Every seeded and preview Plant Protein flavour costs 1499 cents. A forged client price is ignored by the shared quoting engine.
- Two units cost 2998 cents; delivery produces 3497 cents for Germany or 4197 cents for the UK.
- Mixed foxnut boxes and protein items retain correct independent prices, VAT allocation and delivery.
- Stale expected totals reject checkout before stock reservation or payment-session creation. Accepted totals produce immutable paid order snapshots.
- Existing-catalogue migration defaults to dry-run, applies transactionally, increments product versions, creates audit entries and is repeatable without extra mutations.
- Stock needed by singles and boxes is aggregated. Missing saved products remain removable and block checkout.
- Existing related-product links reset quantity. Desktop and sticky mobile purchase actions display the selected quantity total.
- The original DE/EN protein listings show the correct per-unit price. Existing header search and filters continue working.
- New-product admin range selection defaults to 1499 cents for protein without overwriting deliberately entered prices.
- All eight original CSS files and fourteen product-image assets match the first uploaded source byte for byte.
- Production cannot serve an unmarked/preview build. Connected product HTML is indexable; checkout, admin and missing pages are noindex.
- Original payment validation, replay handling, inventory competition, refund, newsletter, MFA and outbox integration tests continue passing.

## Browser walkthrough

Used the managed desktop Chrome preview to inspect the retained Plant Protein listing and the three €14.99 prices. The desktop browser walkthrough also added Chocolate Plant Protein, increased the quantity to two, selected UK delivery and verified €29.98 merchandise plus €11.99 shipping equals €41.97. The DOM suite checks this arithmetic, translated basket names, original product links, both existing purchase controls, DE/EN formatting and admin price defaults. No real order or payment was made. A real phone/browser device matrix and a full accessibility audit remain to be performed.

## Environment repair

The disposable MongoDB binary initially could not open its Unix socket in this container. The test runner now uses `--nounixsocket`; it binds loopback TCP for its isolated replica set. The complete database suite then passed. This flag only affects test database startup.

## Not verified or supplied

- Real Stripe credentials/account permissions, signed events from Stripe, settlement or bank payout.
- Merchant production MongoDB connectivity, actual inventory, SMTP inbox delivery or WhatsApp templates.
- Domain/DNS, public HTTPS deployment, monitoring or backup restoration on the merchant host.
- Verified merchant/legal details, allergen/ingredient/weight/nutrition facts, approved brand story or shipping-policy correctness.
- Real mobile devices, Safari/Firefox matrix, load testing, penetration testing or a complete WCAG conformance audit.

The launch preflight deliberately checks configuration/data and does not substitute for those verifications. See [RELEASE_6_1_1.md](RELEASE_6_1_1.md) for the launch sequence. The archive includes a connected frontend build; the local development default remains the safe preview.
