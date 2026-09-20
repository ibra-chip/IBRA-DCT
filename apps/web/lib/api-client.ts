import type {
  ApiError,
  ApiErrorCode,
  ApiUser,
  DevisInspectResult,
  FinancialSummary,
  InvoiceInspectResult,
  LoginInput,
  LoginResponse,
  ProjectBudget,
  ProjectRecord,
  Purchase,
  PurchaseCategory,
  QuantityEstimateResult,
  QuantityUnit,
  Rendezvous,
  SituationSummary,
  WorkReport,
} from './api-types';

const apiRoutes = {
  login: '/api/auth/login',
  logout: '/api/auth/logout',
  me: '/api/me',
  projects: '/api/projects',
} as const;

const projectPath = (projectId: string) => `${apiRoutes.projects}/${encodeURIComponent(projectId)}`;

const errorCodeForStatus = (status: number): ApiErrorCode => {
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status >= 400 && status < 500) return 'VALIDATION_ERROR';
  return 'SERVER_ERROR';
};

const fallbackMessageForStatus = (status: number) => {
  if (status === 401) return 'Votre session a expiré. Veuillez vous reconnecter.';
  if (status === 403) return "Vous n'avez pas accès à cette ressource.";
  if (status === 404) return 'La ressource demandée est introuvable.';
  return 'Une erreur est survenue. Réessayez.';
};

const parseResponseBody = async (response: Response) => {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}));
  }

  return response.text().catch(() => '');
};

const createApiError = (response: Response, body: unknown): ApiError => {
  const record = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {};
  const message = typeof record.message === 'string'
    ? record.message
    : typeof record.error === 'string'
      ? record.error
      : fallbackMessageForStatus(response.status);

  return {
    code: errorCodeForStatus(response.status),
    message,
    status: response.status,
  };
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init.headers,
    },
  });
  const body = await parseResponseBody(response);

  if (!response.ok) {
    throw createApiError(response, body);
  }

  return body as T;
}

export const apiClient = {
  request,
  login(input: LoginInput) {
    return request<LoginResponse>(apiRoutes.login, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  logout() {
    return request<void>(apiRoutes.logout, { method: 'POST' });
  },
  me() {
    return request<{ user: ApiUser }>(apiRoutes.me).then(({ user }) => user);
  },
  projects() {
    return request<ProjectRecord[]>(apiRoutes.projects);
  },
  project(id: string) {
    return request<ProjectRecord>(projectPath(id));
  },
  getBudget(projectId: string) {
    return request<ProjectBudget>(`${projectPath(projectId)}/budget`);
  },
  inspectDevis(projectId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return request<DevisInspectResult>(`${projectPath(projectId)}/budget/inspect`, {
      method: 'POST',
      body: formData,
    });
  },
  createBudget(projectId: string, payload: { file: File; total: number; devisNumber?: string; client?: string; chantierName?: string; replaceExisting?: boolean }) {
    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('total', String(payload.total));
    if (payload.devisNumber) formData.append('devisNumber', payload.devisNumber);
    if (payload.client) formData.append('client', payload.client);
    if (payload.chantierName) formData.append('chantierName', payload.chantierName);
    if (payload.replaceExisting) formData.append('replaceExisting', 'true');
    return request<ProjectBudget>(`${projectPath(projectId)}/budget`, {
      method: 'POST',
      body: formData,
    });
  },
  getFinancialSummary(projectId: string) {
    return request<FinancialSummary>(`${projectPath(projectId)}/budget/financial-summary`);
  },
  listPurchases(projectId: string) {
    return request<Purchase[]>(`${projectPath(projectId)}/purchases`);
  },
  inspectInvoice(projectId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return request<InvoiceInspectResult>(`${projectPath(projectId)}/purchases/inspect`, {
      method: 'POST',
      body: formData,
    });
  },
  createPurchase(projectId: string, payload: { file: File; category: PurchaseCategory; supplier: string; description: string; amount: number; purchaseDate?: string }) {
    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('category', payload.category);
    formData.append('supplier', payload.supplier);
    formData.append('description', payload.description);
    formData.append('amount', String(payload.amount));
    if (payload.purchaseDate) formData.append('purchaseDate', payload.purchaseDate);
    return request<Purchase>(`${projectPath(projectId)}/purchases`, {
      method: 'POST',
      body: formData,
    });
  },
  estimateQuantity(projectId: string, photo: File, quantityUnit: QuantityUnit) {
    const formData = new FormData();
    formData.append('photo', photo);
    formData.append('quantityUnit', quantityUnit);
    return request<QuantityEstimateResult>(`${projectPath(projectId)}/work-reports/estimate-quantity`, {
      method: 'POST',
      body: formData,
    });
  },
  createWorkReport(projectId: string, payload: {
    photo: File;
    description: string;
    date: string;
    capturedAt: string;
    locationName: string;
    latitude: number;
    longitude: number;
    quantityUnit: QuantityUnit;
    quantity: number;
    unitRate: number;
    m2Source: 'ai' | 'manual';
  }) {
    const formData = new FormData();
    formData.append('photo', payload.photo);
    formData.append('description', payload.description);
    formData.append('date', payload.date);
    formData.append('capturedAt', payload.capturedAt);
    formData.append('locationName', payload.locationName);
    formData.append('latitude', String(payload.latitude));
    formData.append('longitude', String(payload.longitude));
    formData.append('quantityUnit', payload.quantityUnit);
    formData.append('quantity', String(payload.quantity));
    formData.append('unitRate', String(payload.unitRate));
    formData.append('m2Source', payload.m2Source);
    return request<WorkReport>(`${projectPath(projectId)}/work-reports`, {
      method: 'POST',
      body: formData,
    });
  },
  listWorkReports(projectId: string) {
    return request<WorkReport[]>(`${projectPath(projectId)}/work-reports`);
  },
  updateWorkReportStatus(projectId: string, reportId: string, status: 'approved' | 'rejected') {
    return request<WorkReport>(`${projectPath(projectId)}/work-reports/${encodeURIComponent(reportId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
  getSituationSummary(projectId: string, params?: { month?: string; date?: string }) {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', params.month);
    if (params?.date) query.set('date', params.date);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<SituationSummary>(`${projectPath(projectId)}/situation-summary${suffix}`);
  },
  listRendezvous(projectId: string) {
    return request<Rendezvous[]>(`${projectPath(projectId)}/rendezvous`);
  },
  createRendezvous(projectId: string, payload: { absenceDate: string; time: string; reason?: string }) {
    return request<Rendezvous>(`${projectPath(projectId)}/rendezvous`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateRendezvous(projectId: string, rendezvousId: string, payload: { absenceDate?: string; time?: string }) {
    return request<Rendezvous>(`${projectPath(projectId)}/rendezvous/${encodeURIComponent(rendezvousId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};

export type ApiClient = typeof apiClient;
