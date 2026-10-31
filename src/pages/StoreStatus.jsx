import { useStore } from '../context/StoreContext';
import { useI18n } from '../i18n/LanguageContext';

/** Loading skeleton or retry prompt while the catalogue loads. */
export default function StoreStatus() {
  const { t } = useI18n();
  const { loading, error, retry } = useStore();
  if (loading)
    return (
      <main className="page container" aria-busy="true" aria-label={t('common.loading')}>
        <div className="skeleton skeleton--hero" />
      </main>
    );
  if (error)
    return (
      <main className="page container empty">
        <h1>{t('common.catalogError')}</h1>
        <button type="button" className="btn btn--ink" onClick={retry}>
          {t('common.retry')}
        </button>
      </main>
    );
  return null;
}
