# Your JavaScript e-commerce project, step by step

**Current frontend-first launch:** use [the Vercel Git Bash guide](VERCEL_FRONTEND_LAUNCH_BASH.md). The instructions below are for the retained connected backend. Set `VITE_COMMERCE_MODE=connected` for that frontend. GitHub Docker/image jobs now require repository variable `BACKEND_ENABLED=true`; leave it false for the standalone Vercel presentation.

This is a complete source project built on Earthveda v5, not a tutorial that asks you to recreate every file. Follow the commands in order, inspect the named JavaScript files, and test each stage before continuing. You can change the brand and catalogue through the admin panel after setup.

The instructions use **Windows, VS Code and Git Bash**. On Linux/macOS, use Bash with the same npm and Docker commands. Development uses fake payments and a local email inbox. Staging uses real integrations in test mode. Live deployment is the last stage.

## Stage 1 — Install the tools and open VS Code

1. Install the Node.js **24** release from [nodejs.org](https://nodejs.org/). This project declares `>=24 <25`; do not use an older runtime.
2. Install [VS Code](https://code.visualstudio.com/), [Git](https://git-scm.com/), and [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/). On Windows, complete Docker's WSL 2 setup and start Docker Desktop.
3. Extract the project ZIP into a folder you control, for example `C:\Projects\Earthveda_Commerce_JS`. Do not work directly inside the ZIP.
4. Open VS Code → **File → Open Folder** → choose the extracted folder that contains `package.json`.
5. Open **Terminal → New Terminal**. Select Git Bash as the terminal profile.
6. Check the tools:

```bash
node --version
npm --version
git --version
docker version
docker compose version
```

The first command should start with `v24.`. `docker version` must show both a client and a running server. If it only shows a client, start Docker Desktop.

7. Optional VS Code extensions: ESLint and Prettier. The project already contains their configuration. Extensions help while editing; CI runs the checks independently.
8. Install the exact locked dependencies:

```bash
npm ci
```

The foundation already has `package.json`; do not run `npm init` over it. Use `npm ci` when setting up or building a release. It reads `package-lock.json`. Do not delete that file to resolve an installation problem.

## Stage 2 — Create your private local configuration

1. Create the environment file:

```bash
cp .env.example .env
```

2. Generate your application secret locally:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

3. Open `.env` in VS Code. Paste the result after `APP_SECRET=`. Set your admin email and a unique password of at least 12 characters containing letters and numbers.
4. Keep these development settings:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=8787
PUBLIC_SITE_URL=http://localhost:5173
MONGODB_DATABASE=earthveda_dev
PAYMENT_PROVIDER=mock
PAYMENT_ACCOUNT_MODE=single
PAYMENT_MODE=test
REQUIRE_ADMIN_MFA=false
TRUST_PROXY=0
SMTP_URL=smtp://127.0.0.1:1025
CORS_ORIGINS=http://localhost:5173
```

5. Keep `.env` private. `.gitignore` excludes it and production secret files. Every `VITE_*` value is public browser configuration; never put a MongoDB password, Stripe secret, SMTP password or WhatsApp token there.
6. This project does not create a default production administrator. The explicit `admin:create` command creates the first owner.

## Stage 3 — Start MongoDB and initialize its schema

1. Start the local services:

```bash
docker compose up -d mongo mongo-init mailpit
docker compose ps -a
```

2. Wait for MongoDB to be healthy and `mongo-init` to exit with code 0. The initializer creates a single-node replica set named `rs0`. A standalone MongoDB server does not support this project's multi-document transactions.
3. The development URI in `.env` is:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true
```

The host port is bound to `127.0.0.1`. This local database has no authentication and is for development only. Production uses authenticated Atlas access; the production Compose file does not expose a database.

4. Create the validators, indexes, original catalogue and **100 demo units per product per market**:

```bash
npm run db:setup -- --seed --demo-stock
```

5. This creates the products, inventory, orders, admin users/sessions, notification outbox, refund jobs, consent records, settings, audit logs, counters and rate-limit collections. Inspect `server/db/setup.js` for the exact validators and indexes.
6. Seed operations use `$setOnInsert`: rerunning them does not replenish inventory or overwrite edits. Demo stock is forbidden when `NODE_ENV=production`. Production seeds are unpublished drafts with zero stock.
7. To inspect the local database, install [MongoDB Compass](https://www.mongodb.com/products/tools/compass) and use the same URI. View the data; use the admin panel for normal stock/catalogue changes.

## Stage 4 — Create the first owner and run the project

1. Confirm `.env` has `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
2. Create the owner:

```bash
npm run admin:create
```

3. After it succeeds, remove `ADMIN_PASSWORD` from `.env`. Store the password in a password manager. The database stores a salted scrypt hash, not the password.
4. Open three VS Code terminals using the **+** button. Run one command in each:

```bash
npm run dev:api
```

```bash
npm run dev:worker
```

```bash
npm run dev
```

5. Visit [the shop](http://localhost:5173), [the admin panel](http://localhost:5173/admin), and [Mailpit](http://localhost:8025).
6. Vite serves the frontend on port 5173. Its proxy sends `/api` and `/uploads` requests to Node on port 8787. The worker delivers queued messages and reconciles payments/refunds. Both API and worker must run.
7. Useful readiness checks:

```bash
Invoke-RestMethod http://localhost:8787/api/health
Invoke-RestMethod http://localhost:8787/api/ready
```

`health` indicates that the HTTP process responds. `ready` also checks MongoDB and the expected schema version.

8. Enable MFA in **Your account → Authenticator MFA** even during development. Enter your password, copy the setup key into an authenticator, and confirm a six digit code. Setup logs you out. Sign in with the **next** code; reused codes are rejected.
9. `REQUIRE_ADMIN_MFA=true` is mandatory in production. A first login without MFA permits enrollment only; it cannot access products or orders.

## Stage 5 — Create a product, generate its SKU and receive stock

1. Sign in to `/admin`.
2. Choose **Products → New product**.
3. Enter a URL slug, such as `mint-chutney`.
4. Leave SKU blank to generate one on save, or click **Generate SKU now**. The MongoDB counter produces values such as `EV-FNX-000001` or `EV-PRT-000002`. A unique index prevents duplicate SKUs. Gaps in this sequence are normal.
5. Set the price in euros. The API stores integer cents: `2.99` becomes `299`.
6. Enter the German and English names and descriptions. For saleable food, use verified ingredients, allergen information, net weight, nutrition and storage instructions. Do not invent values to make a draft pass validation.
7. Upload a real JPEG, PNG or WebP under 3 MB. The server decodes it, limits input pixels, strips metadata, resizes it and stores a WebP with a content hash filename. SVG uploads are not accepted.
8. Save the product as a draft. New products start with zero stock in both markets.
9. Open **Inventory**. Choose the product and market. Enter an adjustment such as `+50`, and a reason/batch reference. Record the adjustment.
10. Repeat for the other market only if those units are actually available for that market. DE and GB counts are separate inventory pools. If both markets draw from one warehouse, change the inventory model before launch rather than entering the same physical stock twice.
11. Return to the product and publish it. The manual availability flag and positive market inventory must both allow sale. Production rejects publishing incomplete food data.
12. Test the product in the shop. Admin changes appear after catalogue refresh and HTTP caching; checkout always recalculates from server data.
13. Edit the product in two browser tabs. Save one, then try saving the other. The second save should report a stale version instead of overwriting the newer edit.
14. Archive hides the product while retaining historical order snapshots. Restore returns it as a draft; republish after checking it.

## Stage 6 — Understand the Node backend and MongoDB data

Read these files in order:

| File | What to learn |
| --- | --- |
| `server/index.js` | Startup, schema check, HTTP server and shutdown |
| `server/config.js` | Environment validation and production gates |
| `server/app.js` | Connect repositories, services and HTTP routes |
| `server/services/schemas.js` | Zod validation for checkout and admin inputs |
| `server/db/database.js` | MongoClient, pooled connections and transaction sessions |
| `server/db/setup.js` | Collections, database validators and unique indexes |
| `server/db/productRepository.js` | SKU generation and optimistic product edits |
| `server/db/inventoryRepository.js` | Reserve, consume, release and adjust stock |
| `server/services/orderService.js` | Server quote, checkout, verified payment and refund jobs |
| `server/payments/marketProvider.js` | Select and retain the merchant account profile |
| `server/worker.js` | Separate delivery and reconciliation process |

For the frontend, start with `src/App.jsx`, `src/context`, `src/pages`, `src/components`, `src/admin` and `shared/pricing.js`. Shared JavaScript prevents frontend and server arithmetic from diverging, but the server remains authoritative.

The essential product structure is:

```javascript
{
  _id: "stable-product-id", // MongoDB primary key; existing v5 IDs are retained
  sku: "EV-FNX-000001",     // unique, readable warehouse identifier
  slug: "mint-chutney",     // unique public URL
  price: 299,               // integer EUR cents
  active: false,            // draft until approved
  inStock: true,            // manual sale availability switch
  i18n: { de: {/* verified copy */}, en: {/* verified copy */} },
  version: 1               // edit concurrency check
}
```

Inventory is stored separately:

```javascript
{
  _id: "DE:stable-product-id",
  productId: "stable-product-id",
  country: "DE",
  onHand: 50,
  reserved: 2,
  version: 3
}
```

The available quantity is `onHand - reserved`. Starting checkout reserves units. Verified payment reduces both `onHand` and `reserved`. An expired/failed unpaid checkout releases the reservation. A refund does not automatically return goods to stock: inspect the return, then record a stock adjustment.

The transaction helper automatically passes the same MongoDB session to repository operations. Do not start parallel operations inside one transaction. Do not send email or call Stripe inside a transaction callback; a transaction may retry. Save an outbox/job record, commit, then perform the external call in the worker.

See [architecture](ARCHITECTURE.md) for document examples, account routing and failure states.

## Stage 7 — Test shopping with fake payments first

1. Add products and a box to the bag. Check German and UK shipping totals.
2. Use a German delivery address and submit checkout.
3. The mock payment page appears. Click the success simulation.
4. Check that the order becomes `paid`, inventory is consumed once, and a confirmation arrives in Mailpit.
5. In the admin panel, move the order to **processing**, enter a tracking number and move it to **shipped**.
6. Check the shipping email.
7. Request a refund as the owner. The order shows a pending refund and fulfilment pauses. The worker calls the provider and reconciles the confirmed refund; a full confirmed refund changes the status to `refunded`.
8. Check **Refund jobs**. A job marked `sent` means the provider accepted the request; confirm the refunded amount on the order. Pending provider refunds can complete later.
9. Repeat with a UK address. With `PAYMENT_ACCOUNT_MODE=per_market`, the order must retain profile `GB`.
10. Try insufficient stock, invalid postcodes, omitted terms, stale catalogue updates and checkout retries. They should fail without overselling or duplicate orders.

Run the local checks:

```bash
npm run check
npm run test:integration
npm audit --omit=dev --audit-level=high
```

The integration command launches a real disposable MongoDB replica set and downloads a test database binary. If your machine blocks that process/download, use your Docker replica set:

```bash
TEST_MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true' npm run test:integration
```

Tests use a random database name and delete that test database afterward. Never supply a production URI. CI runs this integration suite as a required job before producing an image.

## Stage 8 — Connect Stripe, email and WhatsApp

1. Follow [payments and messaging](PAYMENTS_AND_MESSAGING.md).
2. Set `PAYMENT_PROVIDER=stripe` and keep `PAYMENT_MODE=test`.
3. Choose `single` for one approved merchant account or `per_market` for an approved DE/GB account setup.
4. Add secret test API keys and webhook secrets only to the server environment.
5. Forward signed Stripe events to the correct local webhook endpoint with Stripe CLI. The guide shows both single-account and market-profile URLs.
6. Restart the API and worker after changing environment values.
7. Test successful cards, declined cards, SCA, expired sessions, duplicate events and refunds. Confirm the matching account in the Stripe Dashboard.
8. Configure your real SMTP provider. Verify your sender domain and SPF/DKIM/DMARC. Send a real staging confirmation to your own mailbox.
9. Set up Meta WhatsApp Business Cloud API. Approve the exact transactional templates and their German/English variants. Test with an opted-in recipient.
10. Leave WhatsApp optional if approvals are unfinished. Order confirmation email remains required in production.

The v6 implementation accepts cards and eligible card wallets. PayPal, Klarna and SEPA are **not enabled** in this release. Adding delayed payment methods also requires an inventory policy for payments that finish after a reservation expires.

## Stage 9 — Run the complete app in Docker

This is an alternative to the three VS Code dev processes, not an additional copy of the same API/worker. Stop those processes first.

1. In `.env`, change `PUBLIC_SITE_URL` and `VITE_PUBLIC_SITE_URL` to `http://localhost:8787`, clear `CORS_ORIGINS`, and keep mock payments.
2. Build and start:

```bash
docker compose --profile app up -d --build
docker compose --profile app ps -a
```

3. Create the first owner only if it does not exist:

```bash
docker compose --profile app run --rm api node server/scripts/createAdmin.js
```

4. Visit `http://localhost:8787`. Node serves the built frontend and API from one origin.
5. Inspect operational logs:

```bash
docker compose logs --tail 100 api worker
```

6. Restart the worker during delivery testing and confirm queued work resumes.
7. Stop the app with `docker compose --profile app down`. Do not add `-v` unless you intentionally want to erase local database and upload volumes.
8. Back up the uploaded image volume separately from MongoDB. A container image does not contain images added through the admin panel.

## Stage 10 — Create your GitHub pipeline

1. Create a private GitHub repository for this project. Do not initialize a remote repository that already contains a different codebase without reviewing how to merge it.
2. In the project terminal:

```bash
git init
git add .
git status --short
```

3. Confirm `.env`, `.env.production`, passwords, database dumps and private keys are absent from staged files. Then:

```bash
git commit -m "Add JavaScript MongoDB commerce platform"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPOSITORY.git
git push -u origin main
```

4. In GitHub repository settings, add Actions variables `PUBLIC_SITE_URL` and optionally `WHATSAPP_NUMBER`. These are public build values, not secret tokens.
5. Enable branch protection/rulesets: require the `verify` check, review before merging, and disable direct pushes to main where practical.
6. The included `ci.yml` installs the lockfile, runs lint/format/unit tests/build, runs the real MongoDB integration tests, and audits dependencies. Only a passing push to `main` builds and publishes the Docker image to GHCR.
7. Dependabot configuration is included. Review dependency/image security updates. Actions are pinned to verified commit SHAs; base images use version tags and should be pinned/refreshed under your release policy. The image job scans the exact published digest with Trivy and reports a releasable digest only after the scan passes.
8. Record the `APP_IMAGE=...@sha256:...` value from the image job summary. Deploy the digest, not a mutable `latest` tag.
9. The deployment workflow runs automatically after a passing main-branch image scan when repository variable `DEPLOY_ENABLED=true`. Leave it `false` while provisioning the server/database. It uses repository deployment secrets by default, so a private GitHub Free repository does not need deployment environments. The complete one-time Bash setup is in [CI/CD and deployment](CI_CD_DEPLOYMENT_BASH.md).

## Stage 11 — Prepare a staging server and MongoDB Atlas

The included deployment target is **one Linux VPS/VM + Docker + Caddy + MongoDB Atlas**. You can use a German-region host and a suitable Atlas EU region, subject to your privacy and operational requirements. This design has one application host; choose a load-balanced multi-host platform later if you need application failover.

1. Create a staging hostname such as `staging.your-domain.com`.
2. Provision a supported Linux server. Install Docker Engine and the Compose plugin using Docker's official distribution instructions.
3. Use SSH keys, OS updates and a firewall. Public inbound ports should be 80/443; restrict SSH to your trusted network. Do not publish 8787 or 27017.
4. Follow [the Bash server bootstrap/key instructions](CI_CD_DEPLOYMENT_BASH.md) to create `/opt/earthveda`, install Docker and administrator-owned Compose/Caddy/release files, and restrict the pipeline key with `deploy/ssh-gate.sh`.
5. Create an Atlas cluster that supports transactions. Use a staging database and staging users separate from production.
6. Restrict Atlas network access to the app server's outbound IP or a private endpoint. Do not use `0.0.0.0/0` for the production allow-list.
7. Create a setup user that can create validators/indexes, and a separate runtime user limited to the one application database. Review granular privileges for your Atlas tier; built-in `readWrite` is a baseline, not the smallest possible custom role.
8. Copy `.env.production.example` to `.env.production`. Fill the real Atlas URI, stable random `APP_SECRET`, staging Stripe keys/webhook secrets, `REQUIRE_ADMIN_MFA=true`, verified SMTP and HTTPS hostname. Keep `PAYMENT_MODE=test`.
9. Copy `deploy/release.env.example` to `release.env`. Fill the domain, lowercase `DEPLOY_IMAGE_REPOSITORY` and verified image digest. Protect both files:

```bash
chmod 600 .env.production release.env
```

10. Set the domain's DNS A/AAAA record to the server. Caddy obtains a TLS certificate after DNS resolves and inbound 80/443 work.
11. Log the server into GHCR with a package-read credential if the image is private. Store that credential on the server, outside the source code. Avoid placing it in a shell command history.
12. Pull the image:

```bash
cd /opt/earthveda
docker compose --env-file release.env -f compose.production.yaml pull
```

13. Use the setup database credential for the one-time initialization:

```bash
docker compose --env-file release.env -f compose.production.yaml run --rm --no-deps api node server/scripts/setupDatabase.js --seed
```

14. Create the first owner explicitly, using temporary `ADMIN_EMAIL` / `ADMIN_PASSWORD` values in `.env.production`:

```bash
docker compose --env-file release.env -f compose.production.yaml run --rm --no-deps api node server/scripts/createAdmin.js
```

15. Remove the bootstrap password and switch to the runtime database credential. Recreate containers after secret changes. Never leave the setup credential in the API/worker environment.
16. Start the services:

```bash
docker compose --env-file release.env -f compose.production.yaml up -d --wait --wait-timeout 120
```

17. Sign in over HTTPS, enroll MFA, fill verified business/legal information, complete the food catalogue, enter actual market stock and publish approved products. Production seeds are drafts with no stock; the shop is not automatically open for checkout.
18. Configure the staging Stripe webhooks using the deployed HTTPS hostname. Retest the complete order and refund flows.
19. Configure external checks for `/api/ready`, worker heartbeat, failed refund jobs, notification backlog, disk usage and Atlas backup health. Docker reports unhealthy state but does not itself guarantee restart of an unhealthy running process.

## Stage 12 — Connect the deployment pipeline and go live

1. Create a restricted deployment SSH identity and install its public key on the server. Docker access is powerful; protect this account like a server administrator.
2. Obtain and independently verify the server's SSH host key fingerprint. Do not trust an unverified `ssh-keyscan` result.
3. Add GitHub repository Actions secrets (or environment secrets after enabling a supported deployment environment):

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | Server DNS name or IP |
| `DEPLOY_USER` | Deployment SSH account |
| `DEPLOY_SSH_KEY` | Private key for that deployment identity |
| `DEPLOY_KNOWN_HOSTS` | Verified known_hosts entry |

4. Set `/opt/earthveda/deploy/release.sh` executable with `chmod 750` and keep the deployment files owned by the appropriate administrator.
5. After first server/database setup, set repository variable `DEPLOY_ENABLED=true`. Run **Storefront CI and optional full-stack release** once on `main`, or push/merge a new main commit. Every later main update verifies, builds, scans and deploys automatically. You do not enter arbitrary digests in GitHub.
6. The server script locks concurrent deployments, constrains the image repository, pulls the scanned digest, waits for API/worker health and verifies public HTTPS readiness. A failed release attempts to restore the previous image and reports failure. It does not roll back database schema changes. Future schema changes require a separate migration and backward compatibility plan. See [the Bash runbook](CI_CD_DEPLOYMENT_BASH.md) for rollback and credentials.
7. Complete every item in [verification and launch checklist](VERIFICATION.md). This includes real MongoDB concurrency tests, both merchant profiles, real email delivery, backups/restore and food/tax/legal review.
8. Use a separate production database, payment keys and hostname. Reuse neither staging data nor staging credentials.
9. Only after approval, set `PAYMENT_MODE=live`, install the matching live API keys and live webhook secrets, restart API/worker, and verify a low-value real order and refund in each approved merchant profile.
10. Check the correct settlement bank accounts in Stripe and reconcile payouts. A checkout success screen alone is not evidence that a payout reached a bank.
11. Keep the previous working image digest, tested backups and the incident runbook available.

## Common problems

| Symptom | Check |
| --- | --- |
| MongoDB connection timeout | Docker server, replica initialization, URI and Atlas network access |
| “Run db:setup first” | Correct database name and schema setup command |
| No products can be bought | Draft/archived flags, market inventory and complete food data |
| Email appears skipped | SMTP configuration in the worker; configure the channel and retry the skipped message |
| Order stays unpaid | Correct signed webhook endpoint/account/secret; provider dashboard and worker |
| Admin says enable MFA | Your account page; production enrollment session is deliberately limited |
| Refund remains pending | Worker health, refund job status and the matching provider account |
| Login rejects a correct reused MFA code | Wait for the next 30-second code and keep device time synchronized |
| Docker frontend links to port 5173 | Change PUBLIC_SITE_URL for the container track and rebuild public VITE configuration |
| Windows port already in use | Stop the other API/Vite instance or deliberately change ports and proxy configuration |

Read [security and operations](SECURITY_AND_OPERATIONS.md) before changing a production database directly or recovering an admin account.
