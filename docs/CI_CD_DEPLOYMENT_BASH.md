# Earthveda: automatic CI/CD and deployment with Bash

**Current frontend-first launch:** use [the Vercel Git Bash guide](VERCEL_FRONTEND_LAUNCH_BASH.md). The instructions below are for the retained connected backend. Set `VITE_COMMERCE_MODE=connected` for that frontend. GitHub Docker/image jobs now require repository variable `BACKEND_ENABLED=true`; leave it false for the standalone Vercel presentation.

Updated 11 October 2026. Use **Git Bash on your Windows laptop** and **Bash on the Ubuntu server**. Do not run server commands on your laptop. Replace every `YOUR_...` and `example.com` value before running a command.

The included implementation deploys the app after a passing `main` build. It does not buy a domain, create a VPS, open payment accounts, or copy your local MongoDB data online. Complete the one-time setup below, then ordinary pushes/merges deploy automatically.

## 1. What the pipeline does

| Event | Result |
| --- | --- |
| Pull request | Lockfile install, lint, formatting, unit tests, frontend build, deployment failure tests, real MongoDB replica-set integration tests and dependency audit |
| Push/merge to `main` | All checks, then build `linux/amd64` Docker image, publish to private GHCR, generate SBOM/provenance and scan that exact image digest |
| Passing `main` image + `DEPLOY_ENABLED=true` | SSH release of that digest, API/worker health wait, then public HTTPS `/api/ready` check |
| Failed verification or image scan | Deployment does not start |
| Failed image pull, container startup or HTTPS readiness | Server restores the previous release configuration and attempts to restart/verify it; GitHub reports failure |
| Newer `main` commit exists before deployment starts | Older build skips deployment; the newer passing build can deploy |
| GitHub Actions → Run workflow on `main` | Runs the same verification/build/deployment flow again |

The reusable `deploy.yml` is called by `ci.yml`; you do not run it independently or type an arbitrary image digest into GitHub. Deployment concurrency never cancels an active release. A server lock also prevents overlapping changes. A failed rollback is reported as an incident, not a successful deployment.

Third-party Actions are pinned to full commit SHAs, including official Docker Buildx v4.4.1, Docker login v4.6.0, Docker build/push v7.4.0 and Trivy Action v0.36.0. Review Dependabot updates to keep those pins maintained. Image publication occurs before scanning, but only a passing scan emits the digest used for automatic deployment.

The frontend and API share one HTTPS domain; the separate worker runs the same image. Caddy handles HTTPS. MongoDB Atlas stores application data. Docker volumes retain uploaded product images and TLS state. This is one application server, with brief release downtime; it is not a high-availability or zero-downtime deployment.

## 2. Create your accounts and hosting

1. Create a GitHub account and an **empty private repository** named `earthveda-commerce`. Do not initialize it with a README, license or gitignore.
2. Provision an **x86/amd64 Ubuntu 24.04 VPS**, for example in Germany. A starting size of 2 CPU / 4 GB RAM is a sizing estimate; monitor real traffic and load-test before scaling sales.
3. Add your own administrator SSH public key when creating the VPS. Keep this identity separate from the deployment key created below.
4. Register a domain. Use `staging.YOUR_DOMAIN` for your first test deployment. Set its DNS A record to the VPS public IPv4. Add AAAA only if IPv6 is configured and reachable. Start with DNS-only routing if using Cloudflare, so Caddy is the only proxy.
5. Create a MongoDB Atlas staging cluster and a separate staging database, e.g. `earthveda_staging`. Add only the VPS outbound IP to Atlas network access. Do not allow the entire internet. Use a production tier with the backup features you need when launching live.
6. Create a temporary database setup user scoped to this database and a separate runtime user. The setup user needs schema/index privileges; `dbAdmin` + `readWrite` on this database is a baseline to review with Atlas. Runtime `readWrite` on this database is a starting role. Avoid organization/cluster-wide administrator access.
7. Set up Stripe test keys, the test webhook described in section 8, and a real SMTP service with a verified sending domain.

Default workflows use repository secrets and work without GitHub deployment environments. GitHub environments in a private repository require a supported paid plan. For a team with real payment access, choose a plan supporting private branch protections, require passing `verify` checks and reviews, and restrict changes to workflows/deployment files. Only trusted maintainers should have repository write access.

## 3. Put the updated source on your laptop

Back up your current project and private `.env`. Extract the updated ZIP into a separate folder. Bring your own source edits across deliberately; do not overwrite them by copying an entire old project over the update. Keep local credentials out of Git.

Open Git Bash in the directory containing `package.json`, then:

```bash
pwd
node --version
npm ci
npm run check
```

Use Node 24. `npm run test:deployment` runs on Bash/Linux with Python 3 and `flock`; GitHub's Ubuntu runner runs it automatically. Your laptop does not need to run this Linux deployment test if those utilities are unavailable.

In GitHub **Settings → Secrets and variables → Actions → Variables**, create:

| Repository variable | Initial value |
| --- | --- |
| `PUBLIC_SITE_URL` | `https://staging.YOUR_DOMAIN` |
| `DEPLOY_ENABLED` | `false` until the server and database are ready |
| `WHATSAPP_NUMBER` | Optional public business number, international format, digits only |

These are public build values/control flags. Do not put private tokens into them or any `VITE_*` variable.

For a directory that is not already a Git repository:

```bash
git init
git add .
git status --short
git diff --cached --name-only
```

Confirm no private `.env` files, keys, tokens, database archives or customer exports are staged. The two **example** env files are safe templates and should be committed. Then:

```bash
git commit -m "Add Earthveda commerce with automatic CI/CD"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USER/earthveda-commerce.git
git push -u origin main
```

If your folder already has a Git repository, check `git remote -v` and use its existing remote instead of repeating `git init`/`git remote add`. Sign in through Git for Windows' credential manager when prompted.

Open GitHub **Actions → Storefront CI and optional full-stack release**. Wait for `verify` and `image` to pass. `deploy` is intentionally skipped while the host is being prepared. Copy the full `APP_IMAGE=ghcr.io/...@sha256:...` line from the passing image job summary. If the image scan fails, fix the dependencies/base image and rebuild; do not disable the gate or use that failed image.

## 4. Create a dedicated pipeline SSH key — laptop

```bash
mkdir -p ~/.ssh
ssh-keygen -t ed25519 -f ~/.ssh/earthveda_github_actions -C "earthveda-github-actions"
```

For this unattended deployment key, press Enter for an empty passphrase; the key will be restricted to one release command on the server. This is different from your personal administrator key. Never commit either key.

## 5. Prepare the fresh VPS — administrator session

Use your VPS provider's console to read the server host fingerprint. Connect using your personal admin key, compare that fingerprint, and accept only a match:

```bash
ssh -i ~/.ssh/YOUR_ADMIN_KEY root@YOUR_SERVER_IPV4
```

Exit after verifying access. On your **laptop**, from the updated project directory:

```bash
scp -i ~/.ssh/YOUR_ADMIN_KEY deploy/bootstrap-server.sh root@YOUR_SERVER_IPV4:/root/earthveda-bootstrap.sh
ssh -i ~/.ssh/YOUR_ADMIN_KEY root@YOUR_SERVER_IPV4
```

Now on the **server**:

```bash
apt-get update
apt-get upgrade -y
bash /root/earthveda-bootstrap.sh
```

The script checks Ubuntu/amd64, installs Docker from its official signed APT repository, enables Docker, creates the `earthveda` account and deployment directories. It does not install Node on the host; Node runs inside the app image. Use it on a fresh VPS. It does not remove existing Docker installations or configure your provider's firewall.

Firewall: expose TCP 80/443, optionally UDP 443, and SSH TCP 22. Keep app/database ports 8787/27017 closed. SSH must also be reachable by the GitHub runner. Standard hosted runners do not have one fixed outbound IP; for a strict SSH IP allow-list, use a runner with controlled/static egress and update `runs-on`. A firewall allowing only your home IP will prevent GitHub deployment.

Use key-only SSH authentication and keep provider console recovery available. Once administrator key access is verified, disable SSH passwords with the provider's supported configuration. Docker-published ports have separate firewall behavior; the included production Compose publishes only Caddy.

After verifying administrator key access in another open session, a standard Ubuntu OpenSSH configuration is:

```bash
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\n' > /etc/ssh/sshd_config.d/00-earthveda-keys-only.conf
/usr/sbin/sshd -t
systemctl reload ssh
```

Test a new administrator key login before closing the original session. Keep the host patched and use provider console access for recovery if necessary.

## 6. Install trusted release files and the restricted key

On the **laptop**, from your updated project directory:

```bash
scp -i ~/.ssh/YOUR_ADMIN_KEY compose.production.yaml .env.production.example root@YOUR_SERVER_IPV4:/opt/earthveda/
scp -i ~/.ssh/YOUR_ADMIN_KEY deploy/Caddyfile deploy/release.sh deploy/release.env.example deploy/ssh-gate.sh root@YOUR_SERVER_IPV4:/opt/earthveda/deploy/
scp -i ~/.ssh/YOUR_ADMIN_KEY ~/.ssh/earthveda_github_actions.pub root@YOUR_SERVER_IPV4:/root/earthveda-github-actions.pub
ssh -i ~/.ssh/YOUR_ADMIN_KEY root@YOUR_SERVER_IPV4
```

On the **server**:

```bash
chown root:root /opt/earthveda/compose.production.yaml /opt/earthveda/deploy/Caddyfile
chmod 644 /opt/earthveda/compose.production.yaml /opt/earthveda/deploy/Caddyfile
chown root:earthveda /opt/earthveda/deploy/release.sh
chmod 750 /opt/earthveda/deploy/release.sh
install -o root -g earthveda -m 750 /opt/earthveda/deploy/ssh-gate.sh /usr/local/sbin/earthveda-ssh-gate
printf 'restrict,command="/usr/local/sbin/earthveda-ssh-gate" %s\n' "$(cat /root/earthveda-github-actions.pub)" > /home/earthveda/.ssh/authorized_keys
chown earthveda:earthveda /home/earthveda/.ssh/authorized_keys
chmod 600 /home/earthveda/.ssh/authorized_keys
```

This key permits `release ghcr.io/OWNER/REPOSITORY@sha256:DIGEST` only, with no port forwarding, PTY or general shell. The release script also checks that the image belongs to the repository configured on the server. Do not use this restricted identity for SCP, interactive setup, or migrations. Keep the release script and SSH gate administrator-owned.

The deployment account can operate Docker, so it is privileged. The forced key limits how GitHub uses that account; it does not make Docker access unprivileged. The app containers do not mount the Docker socket.

## 7. Configure the release and private server secrets

Still on the **server**:

```bash
cd /opt/earthveda
cp .env.production.example .env.production
cp deploy/release.env.example release.env
chmod 600 .env.production release.env
nano release.env
```

Set all three values, with **lowercase GHCR owner/repository**:

```dotenv
DOMAIN=staging.YOUR_DOMAIN
DEPLOY_IMAGE_REPOSITORY=ghcr.io/your_github_user/earthveda-commerce
APP_IMAGE=ghcr.io/your_github_user/earthveda-commerce@sha256:THE_64_CHARACTER_DIGEST_FROM_PASSING_CI
```

The `APP_IMAGE` must be the passing CI summary's exact digest. Do not use `latest` or the placeholder. `DOMAIN` is a hostname, without `https://` or a path. Match it with the frontend's `PUBLIC_SITE_URL` repository variable.

Generate two private random values **on your server**, one at a time:

```bash
openssl rand -hex 48
openssl rand -hex 24
nano .env.production
```

Use the first for `APP_SECRET`. Use the second, prefixed with `Ev9-`, for the temporary `ADMIN_PASSWORD` so it contains letters/numbers and exceeds 12 characters. Save the credentials in your password manager. Never paste them into chat or GitHub variables.

Fill `.env.production`:

| Setting | Staging value / purpose |
| --- | --- |
| `NODE_ENV` | `production` — enables security guards even for staging |
| `PUBLIC_SITE_URL` | `https://staging.YOUR_DOMAIN` |
| `MONGODB_DATABASE` | `earthveda_staging` |
| `MONGODB_URI` | Atlas SRV URI, initially using the temporary setup user; URL-encode username/password correctly |
| `APP_SECRET` | First generated value; keep stable because it encrypts admin MFA secrets |
| `REQUIRE_ADMIN_MFA` | `true` |
| `PAYMENT_PROVIDER` | `stripe` — mock payments are rejected by production configuration |
| `PAYMENT_MODE` | `test` |
| `PAYMENT_ACCOUNT_MODE` | `single` unless your market-specific Stripe merchant setup is approved |
| `STRIPE_SECRET_KEY` | Test secret key for single-account mode |
| `STRIPE_WEBHOOK_SECRET` | Test endpoint signing secret; see section 8 |
| `SMTP_URL` | Real TLS SMTP URI, e.g. `smtps://USER:ENCODED_PASSWORD@SMTP_HOST:465` |
| `MAIL_FROM` | Verified sender, e.g. `Earthveda <orders@YOUR_DOMAIN>` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Temporary first owner credentials |
| `TRUST_PROXY` | `1` for the included single Caddy proxy topology |

Keep the template's container paths and port values. Optional WhatsApp tokens stay on the server. Leave `CORS_ORIGINS` empty for this same-origin deployment unless you have a specific reviewed need. Do not use `source .env.production`: the app/Compose parse it as environment data, not Bash code.

Grant the deploy identity ownership of private runtime/release files:

```bash
chown earthveda:earthveda .env.production release.env
chmod 600 .env.production release.env
```

## 8. Prepare the Stripe test endpoint

In Stripe's test/sandbox mode, create a webhook endpoint for the intended URL before starting the app:

```text
https://staging.YOUR_DOMAIN/api/webhooks/stripe
```

Subscribe to `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` and `charge.refunded`. Copy its `whsec_...` signing secret into `.env.production`. Delivery may fail while the host is being prepared; retest once HTTPS is online. See [payments and messaging](PAYMENTS_AND_MESSAGING.md) for event handling and release tests.

For approved `per_market` mode, use the separate `/api/webhooks/stripe/DE` and `/api/webhooks/stripe/GB` endpoints and the matching `STRIPE_DE_*` / `STRIPE_GB_*` credentials. The server routes by validated delivery country. Bank settlement is configured in Stripe, not in GitHub or DNS.

## 9. Give the server access to the private GHCR image

Create a GitHub personal access token **classic**, limited to `read:packages` and access to this private package. Set an expiry and rotate it. Authorize organizational SSO if applicable. The pipeline publishes with GitHub's built-in `GITHUB_TOKEN`; you do not create a separate publishing token.

On the **server**, as administrator:

```bash
runuser -u earthveda -- bash
cd /opt/earthveda
read -r -p 'GitHub username: ' ghcr_user
read -r -s -p 'GHCR read token: ' ghcr_token
printf '\n'
printf '%s' "$ghcr_token" | docker login ghcr.io -u "$ghcr_user" --password-stdin
unset ghcr_token
chmod 700 /home/earthveda/.docker
chmod 600 /home/earthveda/.docker/config.json
docker compose --env-file release.env -f compose.production.yaml config --quiet
docker compose --env-file release.env -f compose.production.yaml pull
```

The login token is not placed in command history. Docker's default credential file is not encrypted; keep it permissioned, use a credential helper where available and treat host access as privileged. Keep previous GHCR digests available for rollback.

## 10. Initialize the empty staging database and owner

Still in the `earthveda` server session, with the **setup** Atlas credential:

```bash
docker compose --env-file release.env -f compose.production.yaml run --rm --no-deps api node server/scripts/setupDatabase.js --seed
docker compose --env-file release.env -f compose.production.yaml run --rm --no-deps api node server/scripts/createAdmin.js
```

Do not pass `--demo-stock`: production configuration rejects it. Seeded products are drafts with zero stock. The admin creation command should succeed before you remove its password. If it reports a password validation error, correct the value in the server file; do not weaken the validator.

Now:

```bash
nano .env.production
```

Replace `MONGODB_URI` with the restricted **runtime** user's URI. Clear `ADMIN_PASSWORD` and `ADMIN_EMAIL` after successful creation. Remove/revoke the temporary setup user's access after verifying the runtime credential works. The first owner remains in MongoDB; clearing these bootstrap fields does not delete the account.

## 11. Start and verify the first release

In the `earthveda` server session:

```bash
first_image=$(sed -n 's/^APP_IMAGE=//p' release.env)
bash deploy/release.sh "$first_image"
docker compose --env-file release.env -f compose.production.yaml ps
curl -fsS https://staging.YOUR_DOMAIN/api/health
curl -fsS https://staging.YOUR_DOMAIN/api/ready
```

Caddy needs working DNS and reachable 80/443 to obtain TLS. If this first launch fails, there is no older working app to restore; the script reports the failure and retains the supplied configuration. Correct the server prerequisites and retry. For a previously healthy installation, later failed releases can restore its image.

Open `https://staging.YOUR_DOMAIN/admin`, sign in with the first owner and enroll MFA. Check the worker health. Fill business details, verify catalogue content/images, allocate physical stock by market and publish only products you are authorized to sell. Your laptop's catalog and uploads are not automatically migrated to Atlas/the VPS; migration is a separate deliberate operation.

Do not publish your staging shop as the live sales site. Test Stripe checkout, signed webhook delivery, stock changes, order confirmation email, refunds and worker retries. WhatsApp can remain disabled while templates/opt-in setup are pending. The production config requires real SMTP even when payments are in test mode.

## 12. Verify the SSH host key and add four GitHub secrets

From the provider's trusted server console or your already verified administrator session:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
cat /etc/ssh/ssh_host_ed25519_key.pub
```

Record the public key/fingerprint. On the **laptop**, collect the matching entry:

```bash
ssh-keyscan -t ed25519 YOUR_SERVER_IPV4 > ~/.ssh/earthveda_deploy_known_hosts
ssh-keygen -lf ~/.ssh/earthveda_deploy_known_hosts
```

Compare the fingerprint with the console result. `ssh-keyscan` by itself does not authenticate the host; do not trust an unmatched entry. The hostname/IP in the entry must exactly match `DEPLOY_HOST`.

In GitHub **Settings → Secrets and variables → Actions → Secrets**, add **repository secrets**:

| Secret name | Value |
| --- | --- |
| `DEPLOY_HOST` | VPS IPv4 used above, without protocol or SSH port |
| `DEPLOY_USER` | `earthveda` |
| `DEPLOY_SSH_KEY` | Entire contents of your laptop's `~/.ssh/earthveda_github_actions`, including BEGIN/END lines |
| `DEPLOY_KNOWN_HOSTS` | Verified contents of `~/.ssh/earthveda_deploy_known_hosts` |

Use VS Code's local file editor to copy the private key into the GitHub secret field; do not print it into logs/chat. Database, Stripe, SMTP and WhatsApp secrets stay in `.env.production` on the server. They are not needed by the build.

Optional supported paid-plan setup: create a `production` deployment environment, restrict it to `main`, move these four secrets there, and replace the optional comment in `deploy.yml` with `environment: production`. The reusable job reads the environment secrets itself; its caller does not select the environment. Leave required-reviewer rules off if you want fully automatic deployment. Reviewer gates, when enabled and available, intentionally pause releases.

## 13. Enable automatic deployment

In the repository's Actions **Variables**, change `DEPLOY_ENABLED` to `true`.

Changing a variable alone does not trigger a run. Open **Actions → Storefront CI and optional full-stack release → Run workflow**, select **main**, and run it. This first automated run rechecks/rebuilds/scans before using SSH. When it finishes, confirm the deployed digest, API/worker health and HTTPS readiness.

Thereafter a merge/push to `main` triggers deployment automatically. Normal development on your laptop:

```bash
git switch -c feature/catalog-update
# Make your source changes.
npm run check
git add .
git diff --cached --name-only
git commit -m "Improve product catalog"
git push -u origin feature/catalog-update
```

Create a pull request, wait for `verify`, review and merge into `main`. For a solo repository without enforced branch protections, direct pushes also trigger the pipeline; protect credentials and workflow write access accordingly.

The pipeline updates the **application image**. It does not overwrite `.env.production`, run database migrations, change DNS, or replace administrator-owned Compose/Caddy/release files. When those files change, review and install them through your administrator identity before deploying code that depends on them. Future schema changes need compatible migrations and backups; image rollback does not reverse data changes.

## 14. Promote to real sales

Use a distinct production Atlas database/users and your live shop hostname. Keep staging credentials/data separate. On the production target, repeat setup with its correct hostname and first owner; configure the pipeline's public URL, deployment secrets and repository allow-list for that target.

Before taking real orders, complete [VERIFICATION.md](VERIFICATION.md): database and upload backups with restore tests, admin MFA, business/product/tax/shipping information, transaction tests, correct market stock, real email delivery, external monitoring and verified merchant/payout accounts. Passing CI covers a subset of these requirements.

Create the **live** Stripe webhook at the live URL. On the server set `PAYMENT_MODE=live` and matching live API/signing secrets. Recreate containers after changing environment credentials:

```bash
docker compose --env-file release.env -f compose.production.yaml up -d --force-recreate --wait --wait-timeout 180
```

Verify a low-value real order and refund in each approved market profile and reconcile the resulting provider settlement. UK prices currently remain EUR. A DE/GB account choice alone does not implement GBP pricing or approve different legal sellers.

## 15. Failure diagnosis and rollback

On the server, using your administrator identity and then the `earthveda` session:

```bash
cd /opt/earthveda
docker compose --env-file release.env -f compose.production.yaml ps
docker compose --env-file release.env -f compose.production.yaml logs --tail=100 api worker caddy
```

Inspect locally; redact secrets/customer data before sharing logs. Do not run `docker compose config` without `--quiet` in shared logs because it can expand private environment values.

| Failure | First checks |
| --- | --- |
| CI Mongo integration | `mongo-init` exit code, disposable replica-set health; never replace test URI with production credentials |
| GHCR denied | Server token `read:packages`, package permissions/SSO and lowercase image name; ensure login is under `earthveda`, not only root |
| SSH denied | Four secrets, verified host entry, authorized public key, gate executable permissions and port 22 access from runner |
| Production configuration rejected | APP_SECRET, HTTPS site URL, authenticated TLS Atlas URI, real `smtps://` SMTP, Stripe test/live key matching and endpoint secret |
| `/api/ready` or worker unhealthy | Atlas allow-list/runtime role, initialized `_schema`, container logs and worker heartbeat |
| HTTPS check fails | DNS A/AAAA, Caddy logs/certificates, 80/443 firewall and hostname match |
| `deploy` skipped | `DEPLOY_ENABLED` exact lowercase `true`, main branch, passing image scan and no newer main commit |
| Rollback unhealthy | Check server resources, Atlas/SMTP/configuration; rolling back code cannot repair an unavailable database or rotated incompatible secrets |

To redeploy a known previous **verified** digest manually as `earthveda`:

```bash
bash /opt/earthveda/deploy/release.sh ghcr.io/your_github_user/earthveda-commerce@sha256:PREVIOUS_VERIFIED_64_CHARACTER_DIGEST
```

Or revert the faulty code commit through Git and let the complete pipeline build/deploy the revert. If incident work needs to pause future releases, set `DEPLOY_ENABLED=false`; this does not stop an already running server-side release.

Never use `docker compose down --volumes` on the production host: it removes persistent uploads and TLS state. The CI cleanup command uses it only on the disposable test runner. Image rollback preserves volumes and MongoDB data; it does not restore them from backups.

## Included files and verification limits

| File | Purpose |
| --- | --- |
| `.github/workflows/ci.yml` | Checks, Docker build, GHCR image scan, automatic deployment caller |
| `.github/workflows/deploy.yml` | Reusable main-only SSH deployment |
| `deploy/bootstrap-server.sh` | Fresh Ubuntu amd64 Docker/account setup |
| `deploy/ssh-gate.sh` | Forced-command entry point for pipeline SSH key |
| `deploy/release.sh` | Repository-constrained digest release, lock, health wait and rollback |
| `deploy/release.env.example` | Hostname, allowed repository and digest template |
| `tests/deployment.sh` | Real Bash script exercised with simulated Docker/HTTPS failures |
| `.gitattributes` | LF line endings for Bash/YAML on Windows |

Local validation is recorded in `docs/VERIFICATION.md`. No server or GitHub workflow was run on your account here. Docker runtime tests, actual GitHub permissions, certificates and external integrations still require the configured services. This guide and code provide the deployment path; they are not evidence of a live shop.

## Official references

- [Docker's Ubuntu installation instructions](https://docs.docker.com/engine/install/ubuntu/)
- [GitHub reusable workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)
- [GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
- [GitHub Container registry authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [GitHub deployment environments and plan availability](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
