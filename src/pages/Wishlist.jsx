import EmptyState from '../components/EmptyState';
import ProductGrid from '../components/ProductGrid';
import Seo from '../components/Seo';
import { useStore } from '../context/StoreContext';
import { useWishlist } from '../context/WishlistContext';
import { useI18n } from '../i18n/LanguageContext';

export default function Wishlist() {
  const { t } = useI18n();
  const { ids } = useWishlist();
  const { products } = useStore();
  const saved = products.filter((p) => ids.includes(p.id));
  return (
    <main className="page container">
      <Seo title={t('wishlist.title')} noindex />
      <header className="page-head">
        <h1>{t('wishlist.title')}</h1>
      </header>
      {saved.length ? (
        <ProductGrid products={saved} label={t('wishlist.title')} />
      ) : (
        <EmptyState
          title={t('wishlist.empty')}
          description={t('wishlist.emptyHint')}
          action={t('nav.shop')}
          to="shop"
        />
      )}
    </main>
  );
}
