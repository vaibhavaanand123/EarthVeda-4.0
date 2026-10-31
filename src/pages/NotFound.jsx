import EmptyState from '../components/EmptyState';
import Seo from '../components/Seo';
import { useI18n } from '../i18n/LanguageContext';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <main className="page container">
      <Seo title={t('notFound.title')} noindex />
      <EmptyState
        title={t('notFound.title')}
        description={t('notFound.lede')}
        action={t('notFound.cta')}
        to="shop"
      />
    </main>
  );
}
