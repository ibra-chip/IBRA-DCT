export type UserRole = 'admin' | 'manager' | 'gerant' | 'user' | 'worker' | string;

export type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed' | 'archived' | string;

export type ChecklistItemStatus = 'pending' | 'review' | 'complete' | 'incomplete' | string;

export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'SERVER_ERROR';

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  company: string;
  companyId?: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  status: ChecklistItemStatus;
  assignedTo?: string | null;
  dueDate?: string | null;
  checklistId: string;
}

export interface Checklist {
  id: string;
  title: string;
  type: string;
  items: ChecklistItem[];
}

export type PurchaseCategory = 'material' | 'tools' | 'machines' | 'workers' | 'subcontracting' | 'other';

export interface ProjectBudget {
  id?: string;
  projectId: string;
  chantierName?: string | null;
  devisNumber?: string | null;
  client?: string | null;
  total: number;
  spent: number;
  remaining: number | null;
  sourceFile?: string | null;
  sourceName?: string | null;
  status: string;
  uploadedBy?: string | null;
  updatedAt?: string;
  createdAt?: string;
}

export interface Purchase {
  id: string;
  projectId: string;
  createdBy: string;
  category: PurchaseCategory | string;
  supplier: string;
  description: string;
  amount: number;
  purchaseDate: string;
  invoiceKey?: string | null;
  invoiceName?: string | null;
  createdAt: string;
}

export interface FinancialSummaryBreakdown {
  material: number;
  tools: number;
  machines: number;
  workers: number;
  subcontracting: number;
  other: number;
  approvedLabor: number;
  approvedWorkHours: number;
}

export interface FinancialSummary {
  projectId: string;
  budget: number;
  purchases: number;
  approvedWorkHours: number;
  approvedLaborTotal: number;
  breakdown: FinancialSummaryBreakdown;
  spent: number;
  remaining: number | null;
  budgetStatus: 'available' | 'missing' | string;
}

export interface DevisExtractedFields {
  number: string;
  client: string;
  chantier: string;
  total: number;
}

export interface DevisInspectResult {
  extracted: DevisExtractedFields;
  textFound: boolean;
  needsConfirmation: boolean;
  source: string;
  aiFallbackUsed: boolean;
}

export interface InvoiceExtractedFields {
  number: string;
  supplier: string;
  date: string;
  amount: number;
}

export interface InvoiceInspectResult {
  textFound: boolean;
  extracted: InvoiceExtractedFields;
  source: string;
  needsOcr: boolean;
}

export interface ProjectRecord {
  id: string;
  name: string;
  location?: string | null;
  status: ProjectStatus;
  company?: { id?: string; name: string } | null;
  documents: Array<{ id: string; status?: string | null }>;
  evidence: Array<{ id: string; status?: string | null }>;
  checklists: Checklist[];
  budget?: ProjectBudget | null;
}

export interface ValidationTask {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  status: ChecklistItemStatus;
  assignedTo?: string | null;
}

export interface DashboardData {
  user: ApiUser;
  projects: ProjectRecord[];
  validationTasks: ValidationTask[];
}

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  status: number;
}

export interface LoginInput {
  email: string;
  password: string;
  next?: string;
}

export interface LoginResponse {
  user: ApiUser;
}
