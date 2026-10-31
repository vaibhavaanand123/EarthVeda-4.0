import { ArrowRight } from 'lucide-react';
import { L } from '../i18n/LanguageContext';

export default function SectionHead({ eyebrow, title, id, children, to, query, cta }) {
  return (
    <div className="section-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id}>{title}</h2>
        {children && <p className="section-head__lede">{children}</p>}
      </div>
      {to && (
        <L className="link link--arrow" to={to} query={query}>
          {cta} <ArrowRight size={16} aria-hidden="true" />
        </L>
      )}
    </div>
  );
}
