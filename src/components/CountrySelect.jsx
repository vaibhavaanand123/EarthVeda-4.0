import { useId } from 'react';
import { COUNTRIES } from '../../shared/markets.js';
import { useCart } from '../context/CartContext';
import { useStore } from '../context/StoreContext';
import { useI18n } from '../i18n/LanguageContext';

/** Delivery country picker; drives shipping cost everywhere. */
export default function CountrySelect({ compact = false }) {
  const { t, lang, money } = useI18n();
  const { country, setCountry } = useCart();
  const { shipping } = useStore();
  const id = useId();
  return (
    <div className={`country${compact ? ' country--compact' : ''}`}>
      <label htmlFor={id}>{t('cart.country')}</label>
      <select id={id} value={country} onChange={(e) => setCountry(e.target.value)}>
        {Object.values(COUNTRIES).map((c) => (
          <option key={c.code} value={c.code}>
            {c.name[lang]}
            {shipping[c.code] ? ` · ${money(shipping[c.code].fee)}` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
