import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  loading?: boolean;
}

export function Button({ children, loading = false, disabled, className = '', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`button ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="button-spinner" aria-hidden="true" /> : null}
      <span>{loading ? 'Connexion…' : children}</span>
    </button>
  );
}
