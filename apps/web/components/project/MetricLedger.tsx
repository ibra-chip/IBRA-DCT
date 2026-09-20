import { formatCount } from '../../lib/formatters';

interface MetricLedgerItem {
  label: string;
  value: number;
}

export function MetricLedger({ items }: { items: MetricLedgerItem[] }) {
  return (
    <section className="metric-ledger" aria-label="Résumé des registres">
      {items.map((item) => (
        <div className="metric-ledger-item" key={item.label}>
          <span>{item.label}</span>
          <strong>{formatCount(item.value)}</strong>
        </div>
      ))}
    </section>
  );
}
