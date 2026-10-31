import { L } from '../i18n/LanguageContext';

export default function EmptyState({ title, description, action, to = 'shop', query, children }) {
  return (
    <div className="empty">
      <div className="empty__peas" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {children}
      {action && (
        <L className="btn btn--ink" to={to} query={query}>
          {action}
        </L>
      )}
    </div>
  );
}
