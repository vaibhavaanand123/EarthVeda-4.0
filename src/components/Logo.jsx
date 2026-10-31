import { L, useI18n } from '../i18n/LanguageContext';

export function LeafMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="leafmark">
      <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M20 31 C 12 25, 13 14, 20 9 C 27 14, 28 25, 20 31 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M20 31 V 14 M20 22 L 16 18 M20 26 L 24 21"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Logo({ onClick }) {
  const { t } = useI18n();
  return (
    <L to="home" className="logo" onClick={onClick} aria-label={t('nav.home')}>
      <LeafMark />
      <span className="logo__words">
        EarthVeda<small>ESSENTIALS</small>
      </span>
    </L>
  );
}
