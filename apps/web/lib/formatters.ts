import type { ProjectRecord, ProjectStatus, PurchaseCategory, UserRole } from './api-types';

const projectStatusLabels: Record<string, string> = {
  planning: 'Planification',
  active: 'Actif',
  paused: 'En pause',
  completed: 'Terminé',
  archived: 'Archivé',
};

const roleLabels: Record<string, string> = {
  admin: 'Administrateur',
  manager: 'Responsable',
  gerant: 'Gérant',
  user: 'Utilisateur',
  worker: 'Ouvrier',
};

const purchaseCategoryLabels: Record<string, string> = {
  material: 'Matériaux',
  tools: 'Outillage',
  machines: 'Machines',
  workers: "Main-d'œuvre",
  subcontracting: 'Sous-traitance',
  other: 'Autre',
};

export const formatCount = (value: number) => new Intl.NumberFormat('fr-FR').format(value);

export const formatProjectStatus = (status: ProjectStatus) => projectStatusLabels[status] ?? status;

export const formatRole = (role: UserRole) => roleLabels[role] ?? role;

export const formatPurchaseCategory = (category: PurchaseCategory | string) => purchaseCategoryLabels[category] ?? category;

export const formatQuantityUnit = (unit: string) => (unit === 'ml' ? 'ml' : 'm²');

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

export const formatLocation = (location?: string | null, company?: string | null) =>
  location || company || 'Localisation non renseignée';

export const projectRecordCounts = (project: ProjectRecord) => ({
  documents: project.documents?.length ?? 0,
  evidence: project.evidence?.length ?? 0,
  checklists: project.checklists?.length ?? 0,
});
