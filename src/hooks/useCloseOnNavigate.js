import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Close an overlay whenever the route changes. */
export function useCloseOnNavigate(close) {
  const { pathname, search } = useLocation();
  useEffect(() => {
    close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);
}
