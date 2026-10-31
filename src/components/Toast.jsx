import { Check } from 'lucide-react';
import { useEffect } from 'react';
import { useCart } from '../context/CartContext';

/** Short confirmation ("Box added to bag"), announced to screen readers. */
export default function Toast() {
  const { toast, dismissToast } = useCart();
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(dismissToast, 3200);
    return () => clearTimeout(id);
  }, [toast, dismissToast]);
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toast && (
        <p className="toast" key={toast.id}>
          <Check size={18} aria-hidden="true" /> {toast.message}
        </p>
      )}
    </div>
  );
}
