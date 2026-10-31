# EarthVeda 6.1.1: original UI preserved

The supplied homepage, product-card arrangement, product-page layout, navigation, fonts, colours, product images and all eight original CSS files are retained. The additional presentation layer from 6.1 has been removed. No new storefront sections, themes, animations, layouts or visual assets are introduced.

Necessary functional feedback uses the existing components and styles: Plant Protein costs €14.99 per unit, quantity totals are consistent, product names remain readable in the bag, delivery estimates respect the selected cart country, and unavailable saved products can be removed. Original related-product navigation resets the purchase quantity. Existing mobile purchase controls use the same selected amount as the main action.

The original search, filters, box quiz, wishlist, keyboard handling, drawer focus trapping and bilingual routes remain. Connected checkout keeps server-side pricing, payment verification, stale-price confirmation and the existing API/worker architecture.

See [VERIFICATION.md](VERIFICATION.md) for tests and [RELEASE_6_1_1.md](RELEASE_6_1_1.md) for setup, existing-database price migration and launch requirements.
