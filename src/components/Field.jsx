import { useId } from 'react';
import { useI18n } from '../i18n/LanguageContext';

/** Labelled input with hint and error wired up via aria-describedby. */
export default function Field({
  label,
  hint,
  error,
  optional = false,
  className = '',
  as = 'input',
  children,
  ...props
}) {
  const { t } = useI18n();
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const Control = as;
  return (
    <div className={`field${error ? ' field--error' : ''} ${className}`}>
      <label htmlFor={id}>
        {label}
        {optional && <span className="field__opt"> ({t('common.optional')})</span>}
      </label>
      <Control
        id={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
        required={!optional}
        {...props}
      >
        {children}
      </Control>
      {error && (
        <p className="field__error" id={errorId}>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}
