# Frontend verification record

EarthVeda Essentials, Vercel-first redesign. Prepared 18 October 2026.

## Executed checks

| Check | Result |
| --- | --- |
| ESLint | Passed |
| Prettier | Passed |
| Unit/business tests | 44 passed, zero skipped |
| React DOM interaction suite | 7 passed, zero skipped; jsdom, not a real browser |
| Production Vite build | Passed |
| Dependency audit | Zero reported vulnerabilities on 18 October 2026 |
| UI suite with outer NODE_ENV=production | Passed before the final image-fallback test was added; the test preload selects React test mode |
| Edited product images | Three outputs visually inspected; obsolete term removed from main text and circular seals |
| Browser/device/layout/screen-reader audit | Not executed: the supported browser-control capability was unavailable |
| Real Vercel deployment and DNS | Not executed here; account/project connection and domain access are required |
| Live payment/newsletter services | Not connected; frontend preview deliberately does not send requests |
| MongoDB/container integration | Not re-executed for this frontend task; the prior environment limitation remains documented in VERIFICATION.md |

An audit with no reported vulnerabilities is time-specific. It is not a security certification.

## Interaction cases

1. Homepage renders without calling the API; German/English switching updates both route and document language.
2. Four flavour pairs form an 8-pack; adding it opens the basket; selecting GB changes the total from 28,91 € to 35,91 €.
3. Basket to checkout navigation, invalid-input handling, example-data fill, PayPal selection, review and demo completion.
4. Checkout details are not written into localStorage/sessionStorage and no API/payment request is made.
5. Newsletter rejects invalid input/missing consent and reports that a valid preview input was not saved or sent.
6. Malformed saved cart recovers; product search and unknown-route recovery work.
7. Drawer Escape behaviour and preview withdrawal information work without a request.
8. Missing-image fallback works again after the selected product changes.

These are seven tests, with several assertions in each. jsdom does not verify CSS layout, touch-device rendering, browser CSP enforcement, real image decoding, DNS or provider behaviour.

Pure tests additionally cover exact 8/16-pack totals in both markets, the 2,99 € single-pack price for all preview products, DE/GB address validation, newsletter consent, corrupt cart input, quantity caps and bilingual copy completeness. Existing shared pricing, service and security tests continue to run.

## Remaining launch work

- Manually verify the deployed site on a phone and desktop, with keyboard, text zoom, reduced motion and a screen reader.
- Review merchant/legal details before a public business publication; preview status and noindex do not remove those obligations.
- Supply the story PDF; the current brand text is provisional, not a claimed PDF transcription.
- Verify actual ingredients, allergens, nutrition, net quantity, unit price and food/operator information before sales.
- Activate and test real server-side orders, inventory, payment methods, webhooks, refunds, newsletter confirmation and unsubscribe before enabling a connected checkout.
- Review the edited packaging assets against approved real packaging and label claims.
- Configure Vercel and DNS using the launch guide; verify the actual Ready deployment and domain HTTPS.
