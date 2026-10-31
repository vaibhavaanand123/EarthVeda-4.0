import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Scroll to top on page change (not on filter/query changes), or to a #hash. */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
      return;
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname, hash]);
  return null;
}
