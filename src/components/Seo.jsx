import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { config } from '../config';
import { useI18n } from '../i18n/LanguageContext';

function setMeta(key, content, attr = 'name') {
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.append(tag);
  }
  tag.setAttribute('content', content);
}

/** Client-side title/description/robots + Product JSON-LD (the server pre-renders the basics). */
export default function Seo({ title, description, product, noindex = false }) {
  const { pathname } = useLocation();
  const { lang } = useI18n();
  useEffect(() => {
    document.title = title ? `${title} | ${config.appName}` : config.appName;
    if (description) setMeta('description', description);
    setMeta('robots', noindex || config.preview ? 'noindex, nofollow' : 'index, follow');
    setMeta('og:title', document.title, 'property');
    if (description) setMeta('og:description', description, 'property');

    document.getElementById('product-jsonld')?.remove();
    if (product && !config.preview) {
      const site = config.publicSiteUrl || window.location.origin;
      const script = Object.assign(document.createElement('script'), {
        id: 'product-jsonld',
        type: 'application/ld+json',
      });
      script.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.fullName,
        sku: product.sku,
        brand: { '@type': 'Brand', name: 'Earthveda Essentials' },
        description: product.description,
        image: `${site}${product.image}`,
        offers: {
          '@type': 'Offer',
          priceCurrency: 'EUR',
          price: (product.price / 100).toFixed(2),
          availability: product.inStock
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          url: `${site}${pathname}`,
        },
      });
      document.head.append(script);
    }
  }, [title, description, product, pathname, noindex, lang]);
  return null;
}
