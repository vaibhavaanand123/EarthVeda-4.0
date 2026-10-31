import { Heart, Menu, Search, ShoppingBag, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useStore } from '../context/StoreContext';
import { useWishlist } from '../context/WishlistContext';
import { useCloseOnNavigate } from '../hooks/useCloseOnNavigate';
import { useDialog } from '../hooks/useDialog';
import { L, useI18n } from '../i18n/LanguageContext';
import AnnouncementBar from './AnnouncementBar';
import Logo from './Logo';

const NAV = [
  { to: 'shop', query: { range: 'foxnuts' }, label: 'nav.foxnuts' },
  { to: 'shop', query: { range: 'protein' }, label: 'nav.protein' },
  { to: 'box', label: 'nav.box', highlight: true },
  { to: 'story', label: 'nav.story' },
];

function NavItem({ item, onClick }) {
  const { t, to } = useI18n();
  const { pathname, search } = useLocation();
  const target = to(item.to);
  const range = new URLSearchParams(search).get('range');
  const active = pathname === target && (!item.query || item.query.range === range);
  return (
    <L
      to={item.to}
      query={item.query}
      onClick={onClick}
      className={
        [active && 'active', item.highlight && 'nav__hl'].filter(Boolean).join(' ') || undefined
      }
      aria-current={active ? 'page' : undefined}
    >
      {t(item.label)}
    </L>
  );
}

/** DE | EN switch. Keeps you on the same page in the other language. */
export function LanguageToggle({ className = '' }) {
  const { lang, t, switchPath } = useI18n();
  return (
    <div className={`lang ${className}`} role="group" aria-label={t('nav.language')}>
      {['de', 'en'].map((code) =>
        code === lang ? (
          <span key={code} className="lang__opt is-on" aria-current="true">
            {code.toUpperCase()}
          </span>
        ) : (
          <Link
            key={code}
            to={switchPath}
            className="lang__opt"
            hrefLang={code}
            lang={code}
            aria-label={t('nav.switchTo')}
          >
            {code.toUpperCase()}
          </Link>
        ),
      )}
    </div>
  );
}

function SearchBar({ onDone }) {
  const { t, to } = useI18n();
  const [query, setQuery] = useState('');
  const { products } = useStore();
  const navigate = useNavigate();
  const q = query.trim().toLowerCase();
  const hits =
    q.length > 1
      ? products
          .filter((p) => `${p.fullName} ${p.rangeLabel} ${p.description}`.toLowerCase().includes(q))
          .slice(0, 6)
      : [];
  const submit = (event) => {
    event.preventDefault();
    if (!q) return;
    navigate(`${to('shop')}?q=${encodeURIComponent(query.trim())}`);
    onDone();
  };
  return (
    <div className="searchbar">
      <form role="search" onSubmit={submit} className="container">
        <Search size={20} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('nav.searchPlaceholder')}
          aria-label={t('nav.searchLabel')}
          autoFocus
          enterKeyHint="search"
        />
        <button
          type="button"
          className="icon-btn"
          onClick={onDone}
          aria-label={t('nav.closeSearch')}
        >
          <X aria-hidden="true" />
        </button>
      </form>
      {hits.length > 0 && (
        <ul className="container searchbar__hits">
          {hits.map((p) => (
            <li key={p.id}>
              <L to="product" params={{ slug: p.slug }} onClick={onDone}>
                <span className="dot" style={{ background: p.accent }} aria-hidden="true" />
                {p.fullName}
              </L>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Header() {
  const { t } = useI18n();
  const cart = useCart();
  const wishlist = useWishlist();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useDialog(menuOpen, () => setMenuOpen(false));
  useCloseOnNavigate(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  });

  return (
    <>
      <a className="skip-link" href="#main">
        {t('common.skip')}
      </a>
      <AnnouncementBar />
      <header className="header">
        <div className="container header__row">
          <button
            type="button"
            className="icon-btn only-mobile"
            onClick={() => setMenuOpen(true)}
            aria-label={t('nav.menu')}
            aria-expanded={menuOpen}
          >
            <Menu aria-hidden="true" />
          </button>
          <Logo />
          <nav className="nav only-desktop" aria-label="Main">
            {NAV.map((item) => (
              <NavItem key={item.label} item={item} />
            ))}
          </nav>
          <div className="header__actions">
            <LanguageToggle />
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label={t('nav.search')}
              aria-expanded={searchOpen}
            >
              <Search aria-hidden="true" />
            </button>
            <L
              to="wishlist"
              className="icon-btn only-desktop badge-host"
              aria-label={t('nav.wishlistCount', { count: wishlist.ids.length })}
            >
              <Heart aria-hidden="true" />
              {wishlist.ids.length > 0 && <span className="badge">{wishlist.ids.length}</span>}
            </L>
            <button
              type="button"
              className="icon-btn badge-host"
              onClick={cart.openDrawer}
              aria-label={t('nav.bag', { count: cart.count })}
            >
              <ShoppingBag aria-hidden="true" />
              {cart.count > 0 && <span className="badge">{cart.count}</span>}
            </button>
          </div>
        </div>
        {searchOpen && <SearchBar onDone={() => setSearchOpen(false)} />}
      </header>

      {menuOpen && (
        <div
          className="overlay overlay--left"
          onClick={() => setMenuOpen(false)}
          role="presentation"
        >
          <nav
            ref={menuRef}
            className="drawer drawer--left"
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.menu')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer__head">
              <Logo onClick={() => setMenuOpen(false)} />
              <button
                type="button"
                className="icon-btn"
                onClick={() => setMenuOpen(false)}
                aria-label={t('nav.closeMenu')}
                data-autofocus
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="mobile-nav">
              {NAV.map((item) => (
                <NavItem key={item.label} item={item} />
              ))}
              <L to="shop">{t('nav.shop')}</L>
              <L to="wishlist">
                {t('nav.wishlist')} ({wishlist.ids.length})
              </L>
              <L to="track">{t('nav.track')}</L>
              <L to="faq">{t('nav.faq')}</L>
              <L to="contact">{t('nav.contact')}</L>
            </div>
            <div className="mobile-nav__foot">
              <span>{t('nav.language')}</span>
              <LanguageToggle />
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
