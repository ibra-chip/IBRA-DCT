import Link from 'next/link';

interface ErrorStateProps {
  title: string;
  message: string;
  onRetry?: () => void;
  action?: { href: string; label: string };
}

export function ErrorState({ title, message, onRetry, action }: ErrorStateProps) {
  return (
    <div className="error-state" role="alert">
      <div>
        <p className="error-state-title">{title}</p>
        <p>{message}</p>
      </div>
      <div className="error-state-actions">
        {onRetry ? <button type="button" className="button secondary" onClick={onRetry}>Réessayer</button> : null}
        {action ? <Link className="button secondary" href={action.href}>{action.label}</Link> : null}
      </div>
    </div>
  );
}
