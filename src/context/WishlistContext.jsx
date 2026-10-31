import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { readJson, writeJson } from '../lib/storage';

const WishlistContext = createContext(null);
const KEY = 'earthveda-wishlist-v2';
const isIdList = (v) => Array.isArray(v) && v.every((id) => typeof id === 'string');

export function WishlistProvider({ children }) {
  const [ids, setIds] = useState(() => readJson(KEY, [], isIdList).slice(0, 100));
  useEffect(() => writeJson(KEY, ids), [ids]);
  const toggle = useCallback(
    (id) =>
      setIds((current) =>
        current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
      ),
    [],
  );
  const value = useMemo(() => ({ ids, has: (id) => ids.includes(id), toggle }), [ids, toggle]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const value = useContext(WishlistContext);
  if (!value) throw new Error('useWishlist must be used inside <WishlistProvider>');
  return value;
}
