import type { ReactNode } from 'react';

interface DossierBandProps {
  eyebrow?: string;
  title: string;
  metadata?: ReactNode;
  action?: ReactNode;
}

export function DossierBand({ eyebrow, title, metadata, action }: DossierBandProps) {
  return (
    <div className="dossier-band">
      <div className="dossier-band-copy">
        {eyebrow ? <span className="dossier-band-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {metadata ? <div className="dossier-band-meta">{metadata}</div> : null}
      </div>
      <div className="dossier-band-action">{action}</div>
      <span className="dossier-fasteners" aria-hidden="true" />
    </div>
  );
}
