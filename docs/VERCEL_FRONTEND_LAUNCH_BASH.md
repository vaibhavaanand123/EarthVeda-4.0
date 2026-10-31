# EarthVeda Essentials: fast Vercel launch with Git Bash

Updated 18 October 2026. This edition redesigns the existing JavaScript commerce project for an interactive frontend presentation on Vercel. It keeps the Node/MongoDB backend for a later connected launch.

## What you can show your funder now

- Redesigned responsive homepage, product catalogue, product pages and brand-story section.
- German at `/` and English at `/en`, with a header language switch that preserves the current page and query.
- Ten example products: seven foxnut flavours and three Plant Protein flavours.
- Single packs at 2,99 €, 8-packs at 23,92 €, 16-packs at 47,84 €.
- Delivery calculation of 4,99 € for Germany and 11,99 € for the UK. Every displayed price remains EUR.
- A three-question flavour quiz, pair-based box builder, editable basket, wishlist and product search.
- A demo checkout with address validation, example-data button, payment-method selection, review and completion.
- Newsletter input with explicit consent and a clear preview response.
- Legal/footer routes, essential-storage settings, error boundaries, missing-image fallback and reduced-motion styling.

The default `VITE_COMMERCE_MODE=preview` makes these flows independent of the API. The preview does not send newsletter emails, store customer addresses, create orders or accept money. It must not be presented as a working payment system. The payment methods shown in the demo are illustrative; the connected backend currently supports Stripe card checkout only.

## Step 1. Extract the updated project and open the correct folder

1. Back up your current source and private environment files.
2. Extract the updated ZIP into a fresh folder. Do not work inside the ZIP viewer.
3. In VS Code, use File > Open Folder and select the inner `Earthveda_Commerce_JS` folder containing `package.json`, `package-lock.json` and `vercel.json`.
4. Open Terminal > New Terminal and select **Git Bash**.
5. Confirm your location and tools:

```bash
pwd
ls package.json package-lock.json vercel.json
node --version
npm --version
git --version
```

Use Node 24. If `package.json` is missing, enter the inner project directory before continuing. Do not run `npm init` or delete the lockfile.

## Step 2. Run the storefront locally

```bash
npm ci
cp .env.vercel.example .env.local
npm run dev
```

Open the localhost URL printed by Vite, usually `http://localhost:5173`. Leave this terminal running. You do not need Docker, MongoDB, `npm run dev:api`, an admin password or Stripe keys for this frontend preview.

`.env.local` should contain:

```dotenv
VITE_COMMERCE_MODE=preview
VITE_PUBLIC_SITE_URL=https://earthvedaessentials.de
VITE_WHATSAPP_NUMBER=
```

All `VITE_*` variables are public. Never put an API secret, database URI, password or payment signing secret there.

Use a second Git Bash terminal for validation:

```bash
npm run check
```

This runs lint, formatting, unit tests, the React DOM interaction tests and the production build. `npm run test:ui` uses jsdom, not a real browser. Manual mobile/browser/screen-reader checks remain part of your launch review.

## Step 3. Complete the public business information

Edit `src/content/site.js` with your **real**:

- Legal business name/form and full service address.
- Contact email and phone/contact method.
- Authorized representative and register information where applicable.
- VAT identification where applicable.
- Food-business operator details and the final approved brand story.

These are public details. Do not enter private account credentials.

A preview does not automatically remove the need for an Impressum and accurate privacy information. Keep your founder presentation behind appropriate deployment protection until the public merchant details are completed. The included preview legal pages are clearly marked drafts and do not certify compliance.

The story PDF was not available among the accessible project/story files. The current story is provisional brand copy, without invented founder history. Replace `siteContent.story.de` and `.en` with the approved PDF narrative when you supply it.

## Step 4. Put the source into GitHub

Create an **empty private GitHub repository**, or use the existing repository that your Vercel project already imports. If you are updating an existing repo, preserve your Git history and remote.

Check first:

```bash
git status
git remote -v
```

If the folder is not a Git repository yet:

```bash
git init
git branch -M main
```

Set a valid author identity **for this repository**. This fixes the invalid-author-email problem you previously saw in Vercel:

```bash
git config user.name "YOUR_NAME"
git config user.email "YOUR_VERIFIED_GITHUB_EMAIL"
```

Use a verified GitHub account email or the exact verified GitHub noreply address from your account settings. A username by itself is not an email address.

Stage and inspect:

```bash
git add .
git diff --cached --name-only
git status --short
```

Do not commit `.env`, `.env.local`, `.env.production`, database dumps, customer exports or private keys. The included `.gitignore` protects normal runtime files; verify what is actually staged. The three example env files are safe templates.

Then:

```bash
git commit -m "Redesign EarthVeda storefront for Vercel preview"
```

For a new remote, copy the exact HTTPS URL from the GitHub repository's Code button:

```bash
git remote add origin https://github.com/YOUR_USER/YOUR_REPOSITORY.git
git push -u origin main
```

If `origin` already exists but points to the wrong repository:

```bash
git remote set-url origin https://github.com/YOUR_USER/YOUR_REPOSITORY.git
git remote -v
git push -u origin main
```

If GitHub says `Repository not found`, confirm that the repository exists and that Git for Windows is signed into an account with access. Copy the actual URL; do not guess the repository name. Authenticate through the credential manager/browser flow rather than putting a token in a URL.

## Step 5. Import or update the project in Vercel

1. Sign in to [Vercel](https://vercel.com/) using the GitHub account with repository access.
2. For a new project, choose Add New > Project, then import the correct repository.
3. For an existing EarthVeda project, check Settings > Git and confirm the linked repository and production branch are correct. Updating the already linked repo avoids creating an unrelated second site.
4. Set the **Root Directory** to the folder containing `package.json` and `vercel.json`. Use `.` when those files are at the repository root. If you uploaded an outer folder, select its inner `Earthveda_Commerce_JS` directory. Do not select `src` or `dist` as the project root.
5. Confirm these settings:

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Node version | 24.x |
| Install command | `npm ci --include=dev` |
| Build command | `npm run check` |
| Output directory | `dist` |
| Production branch | `main` |

The checked-in `vercel.json` supplies the commands, static output, SPA fallback, security headers and asset caching. Do not replace it with a rewrite to `localhost:8787`. Nothing is listening on your laptop from inside Vercel.

6. Add these environment variables for the relevant Preview/Production environments:

| Variable | Value |
| --- | --- |
| `VITE_COMMERCE_MODE` | `preview` |
| `VITE_PUBLIC_SITE_URL` | `https://earthvedaessentials.de` |
| `VITE_WHATSAPP_NUMBER` | Leave empty until you have a real support number |

7. Deploy. Wait until the deployment reports **Ready**.
8. Open the actual `vercel.app` URL shown by Vercel. This guide does not invent a deployment URL or claim a deployment already exists.

EarthVeda is a business project. Vercel's Hobby plan is restricted to personal, non-commercial use; choose a suitable commercial plan for the business website and review the current terms. No paid service was purchased by this code update.

## Step 6. Verify the deployed frontend before sharing it

Perform this short walkthrough on a phone and a desktop:

1. Open `/`, switch to EN, then return to DE.
2. Switch the homepage product range and try the flavour swatches.
3. Search for Mango, open the product details and save it to the wishlist.
4. Complete the quiz for an 8-pack. Check that it contains four flavour pairs and costs 23,92 € before shipping.
5. Add the box, switch the delivery country, and check the totals below.
6. Try the 16-pack and adjust flavours with the plus/minus buttons. There are seven foxnut flavours, so a 16-pack can repeat a flavour pair. Plant Protein is not included in the foxnut bundle.
7. Remove an item, change its quantity, close/reopen the cart and refresh the page.
8. Open checkout, submit empty fields and confirm validation appears.
9. Fill example details, choose PayPal or Klarna, check the demo acknowledgement, review and complete the walkthrough. Confirm that the page says no actual order/payment/email occurred.
10. Submit an invalid newsletter address, then a valid one with consent. The current response must clearly say that it was not saved/sent.
11. Open every legal/footer link, the privacy settings, contact page and story page.
12. Refresh a deep URL such as `/en/shop` or `/en/product/plant-protein-mango`. The SPA rewrite should load the page instead of a Vercel 404.
13. Open an unknown route and verify the recovery link to the shop.
14. Use Tab/Shift+Tab, Space/Enter and Escape. Check drawer focus, quiz step focus, form labels, text zoom and reduced-motion behaviour.

| Basket | Germany total | UK total |
| --- | --- | --- |
| One 2,99 € pack | 7,98 € | 14,98 € |
| 8-pack at 23,92 € | 28,91 € | 35,91 € |
| 16-pack at 47,84 € | 52,83 € | 59,83 € |

The preview intentionally includes no analytics or advertising tags. Its privacy panel explains necessary local storage. A consent-management setup must be reviewed before adding optional tracking later.

## Step 7. Connect earthvedaessentials.de

You need access to the domain's DNS provider/registrar. You do not need to transfer the domain to Vercel.

1. First verify the `vercel.app` deployment works.
2. In the correct Vercel project, open Settings > Domains > Add Domain.
3. Add `earthvedaessentials.de` and `www.earthvedaessentials.de`.
4. Choose which hostname is canonical and set the other to redirect to it. The public-site setting in this project uses the apex `https://earthvedaessentials.de`.
5. Vercel will display the DNS records for **your project**. Copy those exact current values. Do not blindly reuse an IP or CNAME from an old tutorial.
6. At your existing DNS provider, apply the requested apex A/ALIAS record and `www` CNAME, according to the instructions shown. Remove conflicting website records for the same hostnames only when necessary.
7. Preserve unrelated MX, email verification, SPF, DKIM and DMARC records. Changing the website does not require deleting email configuration.
8. If Vercel asks for an ownership TXT record, add the exact displayed value and verify ownership.
9. Wait for Vercel to show a valid configuration and HTTPS certificate. Check both hostnames and the redirect.
10. Changing `VITE_*` values requires a new build. Redeploy after any environment change.

Domain or DNS credentials should stay in your provider's account. Do not paste them into code or chat.

## Step 8. Deploy your next update automatically

Make changes locally and verify them:

```bash
npm run check
git add .
git diff --cached --name-only
git commit -m "Update EarthVeda storefront"
git push origin main
```

Vercel's Git integration builds the new commit. Confirm the deployment's commit hash and Ready state before sharing the URL.

The included GitHub Actions `verify` job also runs the checks and audit. Docker/MongoDB/GHCR/SSH jobs are disabled unless repository variable `BACKEND_ENABLED=true`. For this Vercel-first frontend launch, leave `BACKEND_ENABLED` and `DEPLOY_ENABLED` unset or `false`. Vercel is the deployment service for the current phase.

If a corrected author email needs a new deployment without rewriting published Git history:

```bash
git config user.email "YOUR_VERIFIED_GITHUB_EMAIL"
git log -1 --format='%an <%ae>'
git commit --allow-empty -m "Trigger Vercel with verified author identity"
git push origin main
```

Do not force-push shared history merely to change the author on an older commit.

## Common issues

| Symptom | Fix |
| --- | --- |
| `npm` not found | Install Node 24, reopen VS Code/Git Bash, then check `node --version` |
| `vite` not recognized | Run `npm ci` from the directory with `package.json` |
| `package.json` not found | Enter the extracted inner project directory |
| `remote origin already exists` | Check `git remote -v`; use `git remote set-url origin` for a wrong remote |
| GitHub repository not found | Check exact repository URL, existence and account permissions |
| Vercel author-email error | Configure a verified GitHub email and push a new commit |
| Vercel does not deploy new code | Verify project/repository/branch linkage and inspect the actual deployment commit; check build logs |
| API proxy or connection error | Ensure `VITE_COMMERCE_MODE=preview`, remove old localhost rewrites/settings, redeploy |
| Deep-route 404 | Verify `vercel.json` is committed in the selected Root Directory |
| Build says testing tools are missing | Use `npm ci --include=dev`, as specified in `vercel.json` |
| Demo payment does not charge | Expected: the frontend preview does not process money |
| Newsletter says not saved | Expected until a real subscription service is connected |
| Domain fails | Copy this project's DNS requirements and check conflicting A/AAAA/CNAME records |
| Founder cannot open a protected URL | Check Vercel deployment protection and share using the supported access controls; do not disable protection before public business details are ready |

## What must happen before real sales

A fast frontend presentation and a legally/operationally ready shop are different milestones. Before accepting orders:

1. Connect a secured API/database, initialize real products/stock, require admin MFA and use server-authoritative pricing/availability.
2. Verify and publish all mandatory food information before purchase: ingredients, emphasized allergens, nutrition, net quantity, operator/importer details, storage/use instructions and origin where required. Add the correct unit price per kg where applicable. Do not invent missing food-label information or unsupported health/nutrition claims.
3. Complete merchant details, privacy processing details, terms, withdrawal information and applicable accessibility obligations for your business. The footer layout alone is not legal compliance.
4. Review packaging obligations, LUCID/system participation where applicable, VAT, EU and UK cross-border delivery/customs rules with the relevant qualified professionals.
5. Configure approved live merchant accounts and real payment methods. Logos do not activate PayPal, Klarna, Maestro or wallets. Test successful/failed payments, signed webhooks, refunds, SCA, stock concurrency and account routing.
6. Connect newsletter signup with explicit consent, confirmation/double opt-in, consent records and unsubscribe handling. The current preview deliberately does not collect a mailing list.
7. Connect the visible electronic withdrawal function to the real order system and an immediate durable receipt confirmation, where required. Do not treat the preview information page as a completed legal withdrawal service.
8. Test backup/restore, monitoring, real emails and operational support. The current Vercel project serves static files; it does not run the independent Node worker or MongoDB server.
9. Review the edited packaging artwork against the real approved labels. The three product-image edits are design assets, not certifications that the package text or claims satisfy food law.
10. Only after release review, change to connected mode and deliberately review/remove the preview noindex settings in `vercel.json`, `index.html`, `src/components/Seo.jsx` and `public/robots.txt`. Do not enable indexing while legal/product content is incomplete. Indexability is not access control.

There is no link to the discontinued EU ODR platform. The source for the old platform's closure is linked below. An applicable national dispute-resolution statement still needs review for your actual business.

For the retained VPS backend, use `docs/CI_CD_DEPLOYMENT_BASH.md`. Docker builds default to connected mode; standalone Vercel builds default to preview. Do not turn `connected` on without a properly secured API route and the missing business/integration work.

## Your 13 remarks: implementation status

| Remark | Current result |
| --- | --- |
| Euro unit price 2,99 € | Implemented for all ten preview single packs |
| 8/16 bundles and DE/GB delivery | Implemented with integer-cent calculations and tests |
| Same foxnut/protein image window | Rounded rectangular product frames across the redesign |
| Remove the old product term | Removed from visible copy and the three updated protein images |
| Homepage choose-your-flavours quiz | Implemented; pairs, recommendations, edits and add-to-cart |
| No salty protein flavours/tips | Protein remains Mango, Royal Cream and Chocolate; water/milk/smoothie serving options |
| All desired payment choices | Visual demo choices implemented; real acceptance requires provider activation/testing |
| German/English switch | Implemented in the persistent header |
| PDF story | PDF not available; provisional copy is isolated in `src/content/site.js` for replacement |
| No long dashes in website copy | Source-copy tests enforce this |
| German/EU compliance footer | Links and accurate preview drafts implemented; merchant details/legal review are still required |
| Newsletter email input | Implemented with consent/validation; real collection disabled in preview |
| earthvedaessentials.de | Public setting prepared; your DNS access and Vercel project configuration are required |

## Design and implementation references

Design patterns studied: [Just Nosh](https://www.justnosh.de/) for product discovery and legal navigation, [Huel Germany](https://de.huel.com/) for clear product-range merchandising, and [KoRo](https://www.korodrogerie.de/) for catalogue navigation. No competitor reviews, sales statistics, product claims, legal texts or imagery were copied.

Official platform references:

- [Vite on Vercel and SPA deep-link rewrites](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Vercel domain setup](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
- [Vercel Hobby plan scope](https://vercel.com/docs/plans/hobby)

Legal verification references for the business review, checked 18 October 2026:

- [German provider information: DDG section 5](https://www.gesetze-im-internet.de/ddg/__5.html)
- [EU food-information regulation, including Articles 9 and 14](https://eur-lex.europa.eu/eli/reg/2011/1169/2025-04-01/eng)
- [German electronic withdrawal function: BGB section 356a](https://www.gesetze-im-internet.de/bgb/__356a.html)
- [EU confirmation that the ODR platform closed in 2025](https://consumer-redress.ec.europa.eu/site-relocation_en)

These are source references for review, not a legal opinion tailored to an unidentified merchant.
