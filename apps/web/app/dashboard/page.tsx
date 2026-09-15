'use client';

import { useEffect, useState } from 'react';

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
};

type Project = {
  id: string;
  name: string;
  status: string;
  location?: string | null;
  company?: { name: string };
  documents?: { id: string }[];
  evidence?: { id: string }[];
  checklists?: { id: string }[];
};

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('ibra-token');
    const storedUser = localStorage.getItem('ibra-user');

    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    if (!token) {
      setError('Vous devez être connecté pour consulter le dashboard.');
      setLoading(false);
      return;
    }

    fetch('http://localhost:3001/api/projects', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Accès refusé');
        }

        return response.json();
      })
      .then((data) => setProjects(data))
      .catch(() => setError('Impossible de récupérer les projets.'))
      .finally(() => setLoading(false));
  }, []);

  const metrics = [
    { label: 'Projets actifs', value: String(projects.length || 0), trend: '+12%' },
    { label: 'Documents validés', value: String(projects.reduce((sum, project) => sum + (project.documents?.length ?? 0), 0)), trend: '+28%' },
    { label: 'Contrôles en attente', value: String(projects.reduce((sum, project) => sum + (project.checklists?.length ?? 0), 0)), trend: '-6%' },
    { label: 'Risque conformité', value: 'Low', trend: 'Stable' },
  ];

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-badge">IBRA-BA</div>
        </div>

        <nav className="side-nav">
          <a className="nav-active" href="/dashboard">Vue d’ensemble</a>
          <a href="/dashboard">Projets</a>
          <a href="/dashboard">Documents</a>
          <a href="/dashboard">Checklist</a>
          <a href="/dashboard">IA</a>
          <a href="/dashboard">Rapports</a>
        </nav>
      </aside>

      <section className="content-panel">
        <header className="top-panel">
          <div>
            <p className="eyebrow muted">Dashboard</p>
            <h1>Suivi de conformité</h1>
            {user ? <p className="muted">Bienvenue, {user.name} · {user.company}</p> : null}
          </div>
          <button
            className="button primary"
            onClick={() => {
              localStorage.removeItem('ibra-token');
              localStorage.removeItem('ibra-user');
              window.location.href = '/login';
            }}
          >
            Se déconnecter
          </button>
        </header>

        {error ? <div className="error-box">{error}</div> : null}

        {loading ? <p className="muted">Chargement du tableau de bord...</p> : null}

        <div className="metrics-grid">
          {metrics.map((metric) => (
            <article key={metric.label} className="metric-card">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <em>{metric.trend}</em>
            </article>
          ))}
        </div>

        <div className="two-col">
          <article className="panel-card">
            <div className="panel-header">
              <h2>Projets récents</h2>
              <button className="mini-button">Nouveau projet</button>
            </div>
            <div className="project-list">
              {projects.length > 0 ? (
                projects.map((project) => (
                  <div key={project.id} className="project-row">
                    <div>
                      <h3>{project.name}</h3>
                      <p>{project.location ?? project.company?.name ?? 'Projet interne'}</p>
                    </div>
                    <div className="project-meta">
                      <span className="status-pill">{project.status}</span>
                      <strong>{Math.min(100, (project.documents?.length ?? 0) * 15 + (project.evidence?.length ?? 0) * 10 + (project.checklists?.length ?? 0) * 8)}%</strong>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">Aucun projet pour le moment.</p>
              )}
            </div>
          </article>

          <article className="panel-card">
            <div className="panel-header">
              <h2>À valider</h2>
            </div>
            <ul className="task-list">
              <li>Vérifier les fiches RGE du lot isolation</li>
              <li>Valider les photos de chantier avant cladding</li>
              <li>Signer le rapport de conformité de la façade</li>
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}
