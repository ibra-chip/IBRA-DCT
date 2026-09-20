'use client';

import Link from 'next/link';

import { AppShell } from '../app/AppShell';
import { ProjectRegister } from '../project/ProjectRegister';
import { MetricLedger } from '../project/MetricLedger';
import { ValidationQueue } from '../project/ValidationQueue';
import { DossierBand } from '../ui/DossierBand';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { useDashboardData } from '../../hooks/useDashboardData';

export function DashboardClient() {
  const { status, data, error, retry } = useDashboardData();
  const isLoading = status === 'idle' || status === 'loading';
  const isUnauthorized = error?.code === 'UNAUTHENTICATED';
  const metrics = data ? [
    { label: 'Projets', value: data.projects.length },
    { label: 'Documents', value: data.projects.reduce((total, project) => total + project.documents.length, 0) },
    { label: 'Preuves', value: data.projects.reduce((total, project) => total + project.evidence.length, 0) },
    { label: 'Contrôles', value: data.projects.reduce((total, project) => total + project.checklists.length, 0) },
  ] : [];

  return (
    <AppShell user={data?.user}>
      <div className="dashboard-page">
        <DossierBand
          eyebrow="Vue d’ensemble"
          title="Suivi de conformité"
          metadata={data?.user ? <span>{data.user.name} · {data.user.company}</span> : <span>Registre des projets et preuves de chantier</span>}
          action={data?.user && ['admin', 'manager', 'gerant'].includes(data.user.role) ? <Link className="button primary" href="/dashboard?new=project">Nouveau projet</Link> : null}
        />

        {error ? (
          <ErrorState
            title={isUnauthorized ? 'Connexion requise' : 'Impossible de charger les projets.'}
            message={error.message}
            onRetry={retry}
            action={isUnauthorized ? { href: '/login?next=/dashboard', label: 'Se connecter' } : undefined}
          />
        ) : null}

        {!error && data ? <MetricLedger items={metrics} /> : null}

        <div className="dashboard-grid">
          <section className="register-section" aria-labelledby="projects-title">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Registre</span>
                <h2 id="projects-title">Projets suivis</h2>
              </div>
              {data ? <span className="section-count">{data.projects.length} projet{data.projects.length === 1 ? '' : 's'}</span> : null}
            </div>
            {data?.projects.length === 0 && !isLoading ? (
              <EmptyState title="Aucun projet pour le moment." description="Créez un premier projet pour commencer à suivre les documents et les contrôles." />
            ) : (
              <ProjectRegister projects={data?.projects ?? []} loading={isLoading} />
            )}
          </section>

          <section className="validation-section" aria-labelledby="validation-title">
            <div className="section-heading">
              <div>
                <span className="section-kicker">À traiter</span>
                <h2 id="validation-title">Contrôles qualité</h2>
              </div>
            </div>
            {isLoading ? <div className="validation-skeleton" aria-label="Chargement des contrôles" role="status"><span /><span /><span /></div> : null}
            {!isLoading && data ? <ValidationQueue tasks={data.validationTasks} /> : null}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
