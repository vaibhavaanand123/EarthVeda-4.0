import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { config } from './config';
import { LANGS } from '../shared/markets.js';
import { LEGAL_SLUGS, ROUTES } from '../shared/routes.js';
import CartDrawer from './components/CartDrawer';
import CookieBanner from './components/CookieBanner';
import ErrorBoundary from './components/ErrorBoundary';
import Footer from './components/Footer';
import Header from './components/Header';
import LanguageHint from './components/LanguageHint';
import ScrollToTop from './components/ScrollToTop';
import Toast from './components/Toast';
import WhatsAppButton from './components/WhatsAppButton';
import { CartProvider } from './context/CartContext';
import { ConsentProvider } from './context/ConsentContext';
import { StoreProvider } from './context/StoreContext';
import { WishlistProvider } from './context/WishlistContext';
import { LanguageProvider } from './i18n/LanguageContext';
import Home from './pages/Home';
import PreviewService from './pages/PreviewService';
import PreviewLegal from './pages/PreviewLegal';

// Home ships in the main bundle for the fastest first paint; everything else is split.
const Shop = lazy(() => import('./pages/Shop'));
const Product = lazy(() => import('./pages/Product'));
const BuildBox = lazy(() => import('./pages/BuildBox'));
const Story = lazy(() => import('./pages/Story'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const MockPay = lazy(() => import('./pages/MockPay'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'));
const Track = lazy(() => import('./pages/Track'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const Faq = lazy(() => import('./pages/Faq'));
const Contact = lazy(() => import('./pages/Contact'));
const Legal = lazy(() => import('./pages/Legal'));
const Withdraw = lazy(() => import('./pages/Withdraw'));
const Newsletter = lazy(() => import('./pages/Newsletter'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Admin = lazy(() => import('./admin/AdminApp'));

const PAGES = {
  home: <Home />,
  shop: <Shop />,
  product: <Product />,
  box: <BuildBox />,
  story: <Story />,
  cart: <Cart />,
  checkout: <Checkout />,
  mockPay: config.preview ? <PreviewService /> : <MockPay />,
  orderSuccess: config.preview ? <PreviewService /> : <OrderSuccess />,
  track: config.preview ? <PreviewService /> : <Track />,
  wishlist: <Wishlist />,
  faq: <Faq />,
  contact: <Contact />,
  withdraw: config.preview ? <PreviewService type="withdrawal" /> : <Withdraw />,
  newsletterConfirm: config.preview ? (
    <PreviewService type="newsletter" />
  ) : (
    <Newsletter mode="confirm" />
  ),
  newsletterUnsubscribe: config.preview ? (
    <PreviewService type="newsletter" />
  ) : (
    <Newsletter mode="unsubscribe" />
  ),
  ...Object.fromEntries(
    LEGAL_SLUGS.map((slug) => [
      slug,
      config.preview ? <PreviewLegal key={slug} slug={slug} /> : <Legal key={slug} slug={slug} />,
    ]),
  ),
};

function PageFallback() {
  return (
    <main className="page container" aria-busy="true">
      <div className="skeleton skeleton--hero" />
    </main>
  );
}

function Storefront() {
  return (
    <LanguageProvider>
      <ConsentProvider>
        <StoreProvider>
          <WishlistProvider>
            <CartProvider>
              <ScrollToTop />
              <Header />
              <LanguageHint />
              <div id="main" tabIndex={-1}>
                <ErrorBoundary>
                  <Suspense fallback={<PageFallback />}>
                    <Routes>
                      {Object.entries(PAGES).flatMap(([key, element]) =>
                        LANGS.map((lang) => (
                          <Route
                            key={`${key}-${lang}`}
                            path={ROUTES[key][lang]}
                            element={element}
                          />
                        )),
                      )}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
              </div>
              <Footer />
              <CartDrawer />
              <Toast />
              <WhatsAppButton />
              <CookieBanner />
            </CartProvider>
          </WishlistProvider>
        </StoreProvider>
      </ConsentProvider>
    </LanguageProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route
            path="/admin/*"
            element={
              <Suspense fallback={<PageFallback />}>
                {config.preview ? <Navigate to="/" replace /> : <Admin />}
              </Suspense>
            }
          />
          <Route path="*" element={<Storefront />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
