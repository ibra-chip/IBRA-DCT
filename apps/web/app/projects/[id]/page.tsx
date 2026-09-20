'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, FileText, ListChecks, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { AppShell } from '../../../components/app/AppShell';
import { BudgetPanel } from '../../../components/project/BudgetPanel';
import { WorkReportPanel } from '../../../components/project/WorkReportPanel';
import { DossierBand } from '../../../components/ui/DossierBand';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { StatusPill } from '../../../components/ui/StatusPill';
import { apiClient } from '../../../lib/api-client';
import type { ApiError, ApiUser, ProjectRecord } from '../../../lib/api-types';
import { formatLocation } from '../../../lib/formatters';

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [user, setUser] = useState<ApiUser | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      apiClient.request<ProjectRecord>(`/api/projects/${encodeURIComponent(params.id)}`),
      apiClient.me(),
    ])
      .then(([projectValue, userValue]) => { if (active) { setProject(projectValue); setUser(userValue); } })
      .catch((value: unknown) => {
        if (!active) return;
        setError(value && typeof value === 'object' && 'message' in value ? value as ApiError : { code: 'SERVER_ERROR', message: 'Une erreur est survenue. Réessayez.', status: 500 });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.id]);

  return (
    <AppShell user={user} projectId={project?.id}>
      <div className="project-page">
        <Link className="back-link" href="/dashboard"><ArrowLeft size={16} aria-hidden="true" />Retour aux projets</Link>
        {loading ? <div className="project-page-loading" role="status">Chargement du projet…</div> : null}
        {error ? <ErrorState title="Impossible de charger ce projet." message={error.message} action={{ href: '/dashboard', label: 'Retour aux projets' }} /> : null}
        {project ? (
          <>
            <DossierBand
              eyebrow="Projet"
              title={project.name}
              metadata={<><span>{formatLocation(project.location, project.company?.name)}</span><StatusPill status={project.status} /></>}
            />
            <section className="project-record-grid" aria-label="Registres du projet">
              <article className="record-panel"><FileText size={18} aria-hidden="true" /><span>Documents</span><strong>{project.documents.length}</strong><small>Plans et fichiers techniques</small></article>
              <article className="record-panel"><ShieldCheck size={18} aria-hidden="true" /><span>Preuves</span><strong>{project.evidence.length}</strong><small>Photos et pièces de preuve</small></article>
              <article className="record-panel"><ListChecks size={18} aria-hidden="true" /><span>Contrôles</span><strong>{project.checklists.length}</strong><small>Listes qualité du projet</small></article>
            </section>
            <BudgetPanel projectId={project.id} user={user} />
            <WorkReportPanel projectId={project.id} user={user} />

            <section className="project-next-step">
              <EmptyState title="Le reste du registre arrive ensuite." description="Les documents, contrôles et preuves sont maintenant isolés par projet. Les modules de validation seront activés dans la prochaine étape de parité API." />
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
