import Seo from '../components/Seo';
import { useStore } from '../context/StoreContext';
import { useI18n } from '../i18n/LanguageContext';
import { faqVars } from '../lib/faq';

export default function Faq() {
  const { t, money, lang } = useI18n();
  const store = useStore();
  const vars = faqVars(store, money, lang);
  const items = t('faq.items');
  return (
    <main className="page container narrow">
      <Seo title={t('faq.title')} description={items[0][1]} />
      <h1>{t('faq.title')}</h1>
      <div className="faq faq--page">
        {items.map(([q, a]) => (
          <details key={q} open>
            <summary>{q}</summary>
            <p>{a.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')}</p>
          </details>
        ))}
      </div>
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: items.map(([q, a]) => ({
            '@type': 'Question',
            name: q,
            acceptedAnswer: {
              '@type': 'Answer',
              text: a.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ''),
            },
          })),
        })}
      </script>
    </main>
  );
}
