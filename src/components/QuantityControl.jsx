import { Minus, Plus } from 'lucide-react';
import { useI18n } from '../i18n/LanguageContext';

export default function QuantityControl({
  value,
  onChange,
  label,
  min = 1,
  max = 20,
  size = 'md',
}) {
  const { t } = useI18n();
  return (
    <div className={`qty qty--${size}`} role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={t('cart.decrease')}
      >
        <Minus size={16} aria-hidden="true" />
      </button>
      <output aria-live="polite">{value}</output>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={t('cart.increase')}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
