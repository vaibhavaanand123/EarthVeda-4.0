import BoxBuilder from '../components/BoxBuilder';
import Seo from '../components/Seo';
import { useStore } from '../context/StoreContext';
import { useI18n } from '../i18n/LanguageContext';
import StoreStatus from './StoreStatus';

export default function BuildBox() {
  const { t } = useI18n();
  const store = useStore();
  if (store.loading || store.error) return <StoreStatus />;
  return (
    <main className="page container">
      <Seo title={t('nav.box')} description={t('quiz.lede')} />
      <BoxBuilder headingLevel={1} />
    </main>
  );
}
