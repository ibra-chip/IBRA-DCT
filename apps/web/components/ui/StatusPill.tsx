import { formatProjectStatus } from '../../lib/formatters';

interface StatusPillProps {
  status: string;
}

export function StatusPill({ status }: StatusPillProps) {
  return <span className={`status-pill status-${status}`}>{formatProjectStatus(status)}</span>;
}
