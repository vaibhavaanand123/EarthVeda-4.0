import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import { availableQuantity } from '../../shared/catalog.js';
import { ORDER_LIMITS } from '../../shared/pricing.js';
import { EMPTY_CART, cartReducer, isCartState, summariseCart } from '../lib/cart.js';
import { readJson, writeJson } from '../lib/storage';
import { useI18n } from '../i18n/LanguageContext';
import { analyticsService } from '../services/analyticsService';
import { useStore } from './StoreContext';

const CartContext = createContext(null);
const KEY = 'earthveda-cart-v3';

export function CartProvider({ children }) {
  const store = useStore();
  const { lang } = useI18n();
  const [state, dispatch] = useReducer(cartReducer, undefined, () =>
    readJson(KEY, EMPTY_CART, isCartState),
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => writeJson(KEY, state), [state]);

  // Keep tabs in sync (e.g. bag emptied after paying in another tab).
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === KEY)
        dispatch({ type: 'replace', state: readJson(KEY, EMPTY_CART, isCartState) });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const add = useCallback(
    (product, amount = 1, { openDrawer = true } = {}) => {
      const max = Math.min(
        ORDER_LIMITS.maxQuantityPerLine,
        availableQuantity(product, state.country),
      );
      if (max === 0 || !Number.isInteger(amount) || amount <= 0) return false;
      if ((state.items[product.id] || 0) + amount > max) {
        setToast({
          message:
            lang === 'de'
              ? `Du kannst bis zu ${max} Stück dieser Sorte hinzufügen.`
              : `You can add up to ${max} units of this flavour.`,
          id: Date.now(),
        });
        return false;
      }
      dispatch({ type: 'add', id: product.id, amount });
      analyticsService.track('add_to_cart', { item_id: product.sku, quantity: amount });
      if (openDrawer) setDrawerOpen(true);
      return true;
    },
    [state.country, state.items, lang],
  );

  const addBox = useCallback((bundleId, picks, { openDrawer = true } = {}) => {
    dispatch({ type: 'addBox', bundleId, picks });
    analyticsService.track('add_to_cart', { item_id: bundleId, quantity: 1 });
    if (openDrawer) setDrawerOpen(true);
  }, []);

  const summary = useMemo(
    () =>
      summariseCart(state, {
        resolveProduct: store.resolveProduct,
        resolveBundle: store.resolveBundle,
        shippingRates: store.shipping,
        lang,
      }),
    [state, store.resolveProduct, store.resolveBundle, store.shipping, lang],
  );

  const value = useMemo(
    () => ({
      ...summary,
      ready: !store.loading && !store.error,
      quantityOf: (id) => state.items[id] || 0,
      add,
      addBox,
      setQuantity: (id, quantity) => dispatch({ type: 'set', id, quantity }),
      setBoxQuantity: (key, quantity) => dispatch({ type: 'setBox', key, quantity }),
      remove: (line) =>
        line.kind === 'box'
          ? dispatch({ type: 'setBox', key: line.key, quantity: 0 })
          : dispatch({ type: 'set', id: line.id, quantity: 0 }),
      setCountry: (country) => dispatch({ type: 'country', country }),
      clear: () => dispatch({ type: 'clear' }),
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      toast,
      notify: (message) => {
        setToast({ message, id: Date.now() });
      },
      dismissToast: () => setToast(null),
    }),
    [summary, store.loading, store.error, state.items, add, addBox, drawerOpen, toast],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside <CartProvider>');
  return value;
}
