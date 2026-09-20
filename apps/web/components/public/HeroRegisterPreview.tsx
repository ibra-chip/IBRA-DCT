import { FileText, ListChecks, ShieldCheck } from 'lucide-react';

const previewRows = [
  { name: 'Lot A — Paviljoni 1-4', location: 'Beograd, Nova Industrijska zona', status: 'Actif', documents: 6, evidence: 0, checks: 4 },
  { name: 'La Fontaine Bertin', location: 'Franconville, France', status: 'En préparation', documents: 3, evidence: 2, checks: 2 },
];

export function HeroRegisterPreview() {
  return (
    <div className="hero-register-preview" aria-label="Aperçu du registre de projet de démonstration">
      <div className="preview-caption">
        <span>Aperçu de démonstration</span>
        <small>Données d’exemple, non contractuelles</small>
      </div>
      <div className="preview-table-head">
        <span>Projet</span>
        <span>Statut</span>
        <span>Registres</span>
      </div>
      {previewRows.map((row) => (
        <div className="preview-table-row" key={row.name}>
          <span>
            <strong>{row.name}</strong>
            <small>{row.location}</small>
          </span>
          <span className="preview-status">{row.status}</span>
          <span className="preview-counts">
            <small><FileText size={13} aria-hidden="true" />{row.documents}</small>
            <small><ShieldCheck size={13} aria-hidden="true" />{row.evidence}</small>
            <small><ListChecks size={13} aria-hidden="true" />{row.checks}</small>
          </span>
        </div>
      ))}
    </div>
  );
}
