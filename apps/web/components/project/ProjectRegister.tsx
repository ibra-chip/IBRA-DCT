import Link from 'next/link';
import { ChevronRight, FileText, ListChecks, MapPin, ShieldCheck } from 'lucide-react';

import type { ProjectRecord } from '../../lib/api-types';
import { formatCount, formatLocation } from '../../lib/formatters';
import { StatusPill } from '../ui/StatusPill';

interface ProjectRegisterProps {
  projects: ProjectRecord[];
  loading?: boolean;
}

function SkeletonRows() {
  return (
    <div className="project-register-skeleton" aria-label="Chargement des projets" role="status">
      {[1, 2, 3].map((row) => <div className="skeleton-row" key={row}><span /><span /><span /><span /></div>)}
    </div>
  );
}

export function ProjectRegister({ projects, loading = false }: ProjectRegisterProps) {
  if (loading) return <SkeletonRows />;

  return (
    <div className="project-register-wrap">
      <table className="project-register">
        <caption className="sr-only">Projets suivis</caption>
        <thead>
          <tr>
            <th scope="col">Projet</th>
            <th scope="col">Statut</th>
            <th scope="col"><span className="column-label"><FileText size={14} aria-hidden="true" />Documents</span></th>
            <th scope="col"><span className="column-label"><ShieldCheck size={14} aria-hidden="true" />Preuves</span></th>
            <th scope="col"><span className="column-label"><ListChecks size={14} aria-hidden="true" />Contrôles</span></th>
            <th scope="col"><span className="sr-only">Ouvrir</span></th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const location = formatLocation(project.location, project.company?.name);
            return (
              <tr key={project.id}>
                <td data-label="Projet">
                  <Link className="project-link" href={`/projects/${encodeURIComponent(project.id)}`}>
                    <strong>{project.name}</strong>
                    <span><MapPin size={14} aria-hidden="true" />{location}</span>
                  </Link>
                </td>
                <td data-label="Statut"><StatusPill status={project.status} /></td>
                <td data-label="Documents">{formatCount(project.documents?.length ?? 0)}</td>
                <td data-label="Preuves">{formatCount(project.evidence?.length ?? 0)}</td>
                <td data-label="Contrôles">{formatCount(project.checklists?.length ?? 0)}</td>
                <td className="project-row-action">
                  <Link href={`/projects/${encodeURIComponent(project.id)}`} aria-label={`Ouvrir ${project.name}`}>
                    <ChevronRight size={18} aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
