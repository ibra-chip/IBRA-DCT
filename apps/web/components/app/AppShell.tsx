'use client';

import { ChevronRight, LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import type { ApiUser } from '../../lib/api-types';
import { apiClient } from '../../lib/api-client';
import { formatRole } from '../../lib/formatters';

const primaryNav = [
  { href: '/dashboard', label: 'Vue d’ensemble' },
  { href: '/dashboard?view=projects', label: 'Projets' },
];

interface AppShellProps {
  user?: ApiUser;
  projectId?: string;
  children: ReactNode;
}

function UserMenu({ user }: { user?: ApiUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  async function handleLogout() {
    await apiClient.logout().catch(() => undefined);
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button type="button" className="user-menu-trigger" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="user-initials">{user?.name?.slice(0, 1).toUpperCase() ?? 'I'}</span>
        <span className="user-menu-label">
          <strong>{user?.name ?? 'Espace sécurisé'}</strong>
          <small>{user ? formatRole(user.role) : 'IBRA-BA'}</small>
        </span>
        <ChevronRight className={`user-menu-chevron ${open ? 'is-open' : ''}`} size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div className="user-menu-popover" role="menu">
          {user ? <p>{user.email}</p> : null}
          <button type="button" role="menuitem" onClick={handleLogout}>
            <LogOut size={16} aria-hidden="true" />
            Se déconnecter
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Navigation({ projectId, onNavigate }: { projectId?: string; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="side-nav" aria-label="Navigation principale">
      <span className="nav-section-label">Registre</span>
      {primaryNav.map((item) => {
        const active = pathname === '/dashboard' && item.label === 'Vue d’ensemble';
        return (
          <Link key={item.href} className={`nav-link ${active ? 'is-active' : ''}`} href={item.href} onClick={onNavigate}>
            <span>{item.label}</span>
            {active ? <ChevronRight size={15} aria-hidden="true" /> : null}
          </Link>
        );
      })}
      <span className="nav-section-label nav-section-muted">Projet sélectionné</span>
      <span className="nav-disabled">Qualité</span>
      <span className="nav-disabled">Documents &amp; preuves</span>
      {projectId ? (
        <Link className="nav-link" href={`/projects/${encodeURIComponent(projectId)}#budget`} onClick={onNavigate}>
          <span>Budget</span>
        </Link>
      ) : (
        <span className="nav-disabled">Budget</span>
      )}
      <span className="nav-disabled">Équipe</span>
      <span className="nav-disabled">Assistant IA</span>
      <span className="nav-disabled">Rapports</span>
    </nav>
  );
}

function Sidebar({ user, projectId }: { user?: ApiUser; projectId?: string }) {
  return (
    <aside className="sidebar">
      <Link className="app-brand" href="/">
        <span className="app-brand-mark">I</span>
        <span>IBRA-BA</span>
      </Link>
      <Navigation projectId={projectId} />
      <UserMenu user={user} />
    </aside>
  );
}

export function AppShell({ user, projectId, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen]);

  return (
    <div className="app-shell">
      <Sidebar user={user} projectId={projectId} />
      <div className="mobile-app-bar">
        <Link className="app-brand" href="/">
          <span className="app-brand-mark">I</span>
          <span>IBRA-BA</span>
        </Link>
        <button type="button" className="icon-button" aria-label="Ouvrir la navigation" onClick={() => setDrawerOpen(true)}>
          <Menu size={22} aria-hidden="true" />
        </button>
      </div>
      {drawerOpen ? (
        <div className="mobile-drawer-layer">
          <button className="mobile-drawer-backdrop" type="button" aria-label="Fermer la navigation" onClick={() => setDrawerOpen(false)} />
          <aside className="mobile-drawer" aria-label="Navigation mobile">
            <div className="mobile-drawer-head">
              <span className="app-brand"><span className="app-brand-mark">I</span><span>IBRA-BA</span></span>
              <button type="button" className="icon-button" aria-label="Fermer la navigation" onClick={() => setDrawerOpen(false)}>
                <X size={22} aria-hidden="true" />
              </button>
            </div>
            <Navigation projectId={projectId} onNavigate={() => setDrawerOpen(false)} />
            <UserMenu user={user} />
          </aside>
        </div>
      ) : null}
      <main className="app-content">{children}</main>
    </div>
  );
}
