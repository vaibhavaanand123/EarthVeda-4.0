# Security and operating runbook

## Controls implemented

| Area | Implemented control | Operator responsibility |
| --- | --- | --- |
| Admin identity | Salted asynchronous scrypt hashes, server-side hashed sessions, lockout/rate limits | Unique accounts/passwords; revoke departing staff |
| MFA | TOTP, encrypted secret, replay counter, restricted enrollment session | Protect authenticator and stable APP_SECRET; synchronize clocks |
| Authorization | Owner/staff boundaries; owner-only refunds/exports/team/settings | Assign roles appropriately; add narrower roles as team grows |
| CSRF | Custom mutation header, known origin validation, SameSite cookies | Keep production same-origin and origin allow-list narrow |
| Input | Zod, body limits, explicit IDs, escaped search, MongoDB validation/indexes | Never expose direct database credentials to customers |
| Payments | Hosted card entry, raw-body signature verification, account/session/currency/amount checks | Correct merchant setup, live keys and endpoint secrets |
| Stock | Conditional reservations, transactions, idempotent adjustment history | Correct physical stock by market; inspect returns before restocking |
| Delivery | Durable outbox/jobs, dedupe, leases, retries and reconciliation | Monitor backlog/failed jobs; message sends can duplicate after crashes |
| Media | Decode and re-encode, pixel/byte limits, metadata stripping, no SVG | Back up uploaded images; scan native dependency/image updates |
| HTTP | Helmet CSP/security headers, explicit CORS, no-store admin/order responses | HTTPS reverse proxy; no direct public API container port |
| Runtime | Non-root image, read-only production root FS, dropped app capabilities, bounded logs | Patched host/images, firewall, restricted deployment identity |
| Secrets/data | Server-only env, TLS MongoDB/SMTP in production, MFA encryption, redacted logs | Private secret storage, least privilege, Atlas encryption/backup configuration |
| Release | Locked dependencies, pinned Actions, checks/integration/audit/image-scan gates, digest deploy and health wait | Protected branches, reviewed releases and verified SSH host keys |

These controls reduce specific risks; they do not certify the application as secure or compliant. Run the integration suite and staging/operational checks before taking live orders. Review the launch checklist and your business-specific requirements.

## Production data access

Use separate staging/production databases and users. Limit Atlas network access to the app server/private endpoint and grant runtime access only to its application database. Use a different temporary setup identity for validators/indexes; remove it from the running app afterward.

Atlas/database encryption at rest is a deployment property. Addresses/emails are not field-encrypted by this application. MFA secrets use AES-256-GCM with a key derived from APP_SECRET. Passwords and session/consent tokens are one-way hashed. Restrict access to database dumps, admin exports and uploaded media.

The production Compose setup routes internet traffic through Caddy only. API/worker have no published host port. `TRUST_PROXY=1` matches that one-proxy topology; change it only after reviewing the actual network path. Development binds services/database/email inbox to loopback. Keep SSH and the Docker socket restricted.

## Secrets and rotation

Never commit `.env`, `.env.production`, `release.env`, database archives, private keys or tokens. All `VITE_*` settings are public. Keep production credentials in a managed secret store or tightly permissioned deployment environment files. GitHub holds only the deployment secrets needed by its workflow.

Rotate Stripe/SMTP/WhatsApp/SSH credentials using provider procedures, deploy the replacements, test and revoke old values. **Do not replace APP_SECRET casually**: existing MFA secrets cannot decrypt with a different key. A planned app-secret rotation needs controlled re-encryption of stored MFA secrets or offline MFA re-enrollment, plus session revocation and recovery testing. Protect the old key until the migration/restore retention window ends.

Remove bootstrap admin passwords after account creation. All production accounts must enable MFA. Keep business owners' recovery access in a password manager; do not send setup keys in chat/email or put them in tickets.

## Monitoring

Monitor at least:

- HTTPS `/api/ready` availability and latency.
- API and worker container health and restarts.
- Internal `_worker.value.lastSuccessAt`; alert when older than 120 seconds.
- Pending/sending outbox/jobs age, failed/skipped notifications and failed refund jobs.
- `review_required` orders, stuck reservations and refundReserved amounts.
- Provider webhook failures, payment/refund status and payout reconciliation.
- Disk space, upload volume growth, memory and CPU.
- Atlas health, backup success and tested restore evidence.
- Dependency/container vulnerabilities and unusual admin-login failures.

Docker health checks report status; an unhealthy-but-running process does not automatically gain a failover host. Add an external monitor and alerting/service management appropriate to your host. Caddy access logs are not enabled by default to avoid storing query tokens; the app logs request paths without query/body and redacts upstream errors.

SMTP/WhatsApp API acceptance is not delivery/read confirmation. Provider delivery/bounce/receipt ingestion is not included. Monitor provider dashboards and add the needed callbacks for your operating requirements.

## Backup and restore

For production, use a suitable Atlas backup tier with snapshots/PITR, retention and restore procedures. Verify that your chosen tier actually provides the backup features you need. Define RPO/RTO with the business; do not assume an advertised database backup covers image uploads or app configuration.

Maintain separate encrypted backups for:

1. MongoDB application data and indexes/validators.
2. The persistent uploads volume.
3. Deployment configuration, required secrets and image release digests.

Keep a verified copy off the application host and restrict access. Test restoring into an isolated staging database and a restored upload volume. Do not point a restored test environment at live Stripe/SMTP/WhatsApp keys: it could repeat real jobs or messages.

`npm run db:backup -- --writers-stopped` uses installed MongoDB Database Tools to create a **logical offline** archive. Stop API, worker, migrations and all other writers first. This is not a consistent cross-collection backup under concurrent writes. The script puts connection credentials in a private temporary config file, removes it afterward and writes a private archive. Encrypt and copy that archive off-host. Use Atlas PITR for continuous online protection.

Restore an offline archive using `mongorestore` with credentials supplied through a protected config, into an isolated empty target. Verify counts, stock/order invariants and image URLs before approving a cutover. Do not run `--drop` against the live database as a troubleshooting shortcut.

## Deployment and rollback

After a passing main-branch build/image scan, CI calls the reusable SSH deployment workflow when `DEPLOY_ENABLED=true`. Repository Actions secrets are the default; a deployment environment is optional on a supported plan. The pipeline key is restricted by `deploy/ssh-gate.sh` to one release command. Administrator-owned deployment files remain outside automatic image updates.

`deploy/release.sh` constrains the allowed GHCR repository using `DEPLOY_IMAGE_REPOSITORY`, atomically updates the digest in `release.env`, uses a host lock, pulls the image, waits for API/worker health and checks public HTTPS readiness. Failure restores the previous configuration and attempts to verify its health. An unhealthy rollback is reported and needs operator action. Rollback covers the application image, not data/schema or environment-secret changes. Current schema version is 1; future migrations require explicit compatibility and backups. Follow [the Bash deployment runbook](CI_CD_DEPLOYMENT_BASH.md).

For a manual application rollback:

```bash
cd /opt/earthveda
bash deploy/release.sh ghcr.io/YOUR_LOWERCASE_OWNER/YOUR_LOWERCASE_REPO@sha256:PREVIOUS_VERIFIED_DIGEST
```

Verify checkout/reconciliation and the restored image identity. Expect brief replacement downtime on one host. For higher availability, move to multiple application hosts, shared object storage and a load balancer rather than mounting independent local upload volumes.

## Incident procedures

**Payment mismatch or late money**

Do not pack `review_required` orders. Check the retained merchant profile, session, currency, captured amount and event history in that account. Valid late payments queue automatic refunds. A mismatch requires provider/account review; a full provider-confirmed refund resolves it. Never manually mark an order paid to bypass a check.

**Refund job failure**

Keep fulfilment paused while `refundReserved > 0`. Inspect the matching account and stable refund-job metadata before retrying. A transport failure can occur after the provider created a refund; the adapter checks existing metadata and uses an idempotency key. A known failed/cancelled provider refund needs an operator decision; repeated retry of that same failed provider refund cannot turn it into a new successful refund. Document recovery and reconcile reserved/confirmed amounts with the provider before creating a new refund operation. Do not clear reserved money just to make the fulfilment buttons work.

**Worker crash**

Restart it, check heartbeat and backlog. Expired leases can be reclaimed. Confirm pending refund requests and messages. External email/WhatsApp may duplicate across a send/record crash, so do not claim exactly-once delivery.

**Compromised admin account**

Deactivate the account as an owner; sessions are revoked. Rotate any exposed provider/server credentials, investigate audit logs/exports/refunds, preserve evidence and follow your incident/privacy notification procedure.

**Lost authenticator**

This release intentionally has no public MFA-reset endpoint. A trusted operator with server/database access performs offline recovery:

1. Stop API and worker, verify the person's identity through your business process, and preserve the audit evidence.
2. Set `RECOVERY_EMAIL` in the private environment and invoke `server/scripts/resetMfa.js --offline-recovery` using the app image or local runtime.
3. The script clears MFA, revokes all sessions and adds an audit entry.
4. Remove RECOVERY_EMAIL and restart services. The user can log in only to enroll MFA again; verify successful enrollment before restoring normal work.

If a deployment account can operate Docker/read production secrets, it has powerful server access. Treat that identity as privileged, restrict its key and rotate it on personnel changes.

## Privacy, food and market launch review

Order/contact/consent data is personal data even if a field is hashed. Establish access rules, retention/deletion schedules, processor agreements and EU/UK transfer/hosting decisions. Preserve required accounting records while handling valid access/deletion requests; use a reviewed policy rather than deleting historical orders indiscriminately.

Confirm verified product ingredients/allergens/nutrition/net weight, food-business registration/responsibility, traceability/recalls, actual shipping coverage, tax classification/VAT, invoices, consumer withdrawal/terms, imprint/privacy/accessibility and marketing consent. Existing legal-page templates are starting copy and require qualified review for the actual entities/products/markets. This code does not implement food batch/expiry tracking or an accounting filing system.

The original seed VAT values are examples from v5, not a determination that every product is taxable at those rates. Do not launch using guessed tax or nutrition data.

## Source references

- [MongoDB security checklist](https://www.mongodb.com/docs/manual/administration/security-checklist/)
- [MongoDB Atlas backup](https://www.mongodb.com/docs/atlas/backup/cloud-backup/overview/)
- [Stripe webhooks](https://docs.stripe.com/webhooks)
- [OWASP application security verification standard](https://owasp.org/www-project-application-security-verification-standard/)
- [Docker production guidance](https://docs.docker.com/compose/how-tos/production/)
