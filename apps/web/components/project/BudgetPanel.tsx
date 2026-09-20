'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Field } from '../ui/Field';
import { apiClient } from '../../lib/api-client';
import type { ApiError, ApiUser, DevisInspectResult, FinancialSummary, ProjectBudget, Purchase, PurchaseCategory } from '../../lib/api-types';
import { formatCurrency, formatPurchaseCategory } from '../../lib/formatters';

const PURCHASE_CATEGORIES: PurchaseCategory[] = ['material', 'tools', 'machines', 'workers', 'subcontracting', 'other'];

const isApiError = (value: unknown): value is ApiError =>
  typeof value === 'object' && value !== null && 'message' in value;

const errorMessage = (value: unknown, fallback: string) => (isApiError(value) ? value.message : fallback);

interface DevisFormState {
  total: string;
  devisNumber: string;
  client: string;
  chantierName: string;
}

const emptyDevisForm: DevisFormState = { total: '', devisNumber: '', client: '', chantierName: '' };

function DevisUploadForm({ projectId, replacing, onDone }: { projectId: string; replacing: boolean; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [inspectResult, setInspectResult] = useState<DevisInspectResult | null>(null);
  const [form, setForm] = useState<DevisFormState>(emptyDevisForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleInspect() {
    if (!file) return;
    setInspecting(true);
    setError('');
    try {
      const result = await apiClient.inspectDevis(projectId, file);
      setInspectResult(result);
      setForm({
        total: result.extracted.total ? String(result.extracted.total) : '',
        devisNumber: result.extracted.number,
        client: result.extracted.client,
        chantierName: result.extracted.chantier,
      });
    } catch (requestError) {
      setError(errorMessage(requestError, 'Impossible de lire ce devis. Réessayez.'));
    } finally {
      setInspecting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError('Sélectionnez le PDF du devis.');
      return;
    }
    const total = Number(form.total);
    if (!Number.isFinite(total) || total <= 0) {
      setError('Le montant total du devis est requis.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiClient.createBudget(projectId, {
        file,
        total,
        devisNumber: form.devisNumber || undefined,
        client: form.client || undefined,
        chantierName: form.chantierName || undefined,
        replaceExisting: replacing,
      });
      setFile(null);
      setInspectResult(null);
      setForm(emptyDevisForm);
      onDone();
    } catch (requestError) {
      setError(errorMessage(requestError, "Impossible d'enregistrer le budget."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="budget-form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="devis-file">Devis (PDF)</label>
        <input
          id="devis-file"
          type="file"
          accept="application/pdf"
          disabled={submitting}
          onChange={(event) => { setFile(event.target.files?.[0] ?? null); setInspectResult(null); }}
        />
      </div>
      <Button type="button" className="secondary" disabled={!file || inspecting || submitting} onClick={handleInspect}>
        {inspecting ? 'Analyse du devis…' : 'Analyser le devis'}
      </Button>

      {inspectResult ? (
        <>
          <p className="field-hint">
            {inspectResult.needsConfirmation
              ? 'Certains champs sont incertains, vérifiez-les avant de confirmer.'
              : 'Champs détectés automatiquement, vérifiez-les avant de confirmer.'}
            {inspectResult.aiFallbackUsed ? ' (lecture assistée par IA)' : ''}
          </p>
          <Field label="Chantier" name="chantierName" value={form.chantierName} onChange={(event) => setForm((current) => ({ ...current, chantierName: event.target.value }))} disabled={submitting} />
          <Field label="Client" name="client" value={form.client} onChange={(event) => setForm((current) => ({ ...current, client: event.target.value }))} disabled={submitting} />
          <Field label="N° de devis" name="devisNumber" value={form.devisNumber} onChange={(event) => setForm((current) => ({ ...current, devisNumber: event.target.value }))} disabled={submitting} />
          <Field label="Total TTC (€)" name="total" type="number" min="0" step="0.01" value={form.total} onChange={(event) => setForm((current) => ({ ...current, total: event.target.value }))} disabled={submitting} required />
          {error ? <p className="form-alert" role="alert">{error}</p> : null}
          <Button type="submit" className="primary" disabled={submitting}>
            {submitting ? 'Enregistrement…' : replacing ? 'Remplacer le budget' : 'Créer le budget'}
          </Button>
        </>
      ) : error ? <p className="form-alert" role="alert">{error}</p> : null}
    </form>
  );
}

interface PurchaseFormState {
  category: PurchaseCategory;
  supplier: string;
  description: string;
  amount: string;
  purchaseDate: string;
}

const emptyPurchaseForm: PurchaseFormState = { category: 'material', supplier: '', description: '', amount: '', purchaseDate: '' };

function PurchaseUploadForm({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [inspected, setInspected] = useState(false);
  const [form, setForm] = useState<PurchaseFormState>(emptyPurchaseForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleInspect() {
    if (!file) return;
    setInspecting(true);
    setError('');
    try {
      const result = await apiClient.inspectInvoice(projectId, file);
      setForm((current) => ({
        ...current,
        supplier: result.extracted.supplier || current.supplier,
        description: current.description,
        amount: result.extracted.amount ? String(result.extracted.amount) : current.amount,
        purchaseDate: current.purchaseDate,
      }));
      setInspected(true);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Impossible de lire cette facture. Réessayez.'));
    } finally {
      setInspecting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError('Sélectionnez le PDF de la facture.');
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !form.supplier.trim() || !form.description.trim()) {
      setError('Fournisseur, description et montant sont requis.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiClient.createPurchase(projectId, {
        file,
        category: form.category,
        supplier: form.supplier.trim(),
        description: form.description.trim(),
        amount,
        purchaseDate: form.purchaseDate || undefined,
      });
      setFile(null);
      setInspected(false);
      setForm(emptyPurchaseForm);
      onDone();
    } catch (requestError) {
      setError(errorMessage(requestError, "Impossible d'enregistrer cette facture."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="budget-form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="purchase-file">Facture (PDF)</label>
        <input
          id="purchase-file"
          type="file"
          accept="application/pdf"
          disabled={submitting}
          onChange={(event) => { setFile(event.target.files?.[0] ?? null); setInspected(false); }}
        />
      </div>
      <Button type="button" className="secondary" disabled={!file || inspecting || submitting} onClick={handleInspect}>
        {inspecting ? 'Analyse de la facture…' : 'Analyser la facture'}
      </Button>

      {inspected ? (
        <>
          <div className="field">
            <label htmlFor="purchase-category">Catégorie</label>
            <select
              id="purchase-category"
              value={form.category}
              disabled={submitting}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as PurchaseCategory }))}
            >
              {PURCHASE_CATEGORIES.map((category) => (
                <option key={category} value={category}>{formatPurchaseCategory(category)}</option>
              ))}
            </select>
          </div>
          <Field label="Fournisseur" name="supplier" value={form.supplier} onChange={(event) => setForm((current) => ({ ...current, supplier: event.target.value }))} disabled={submitting} required />
          <Field label="Description" name="description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} disabled={submitting} required />
          <Field label="Montant (€)" name="amount" type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} disabled={submitting} required />
          <Field label="Date" name="purchaseDate" type="date" value={form.purchaseDate} onChange={(event) => setForm((current) => ({ ...current, purchaseDate: event.target.value }))} disabled={submitting} />
          {error ? <p className="form-alert" role="alert">{error}</p> : null}
          <Button type="submit" className="primary" disabled={submitting}>
            {submitting ? 'Enregistrement…' : 'Ajouter la facture'}
          </Button>
        </>
      ) : error ? <p className="form-alert" role="alert">{error}</p> : null}
    </form>
  );
}

export function BudgetPanel({ projectId, user }: { projectId: string; user?: ApiUser }) {
  const [budget, setBudget] = useState<ProjectBudget | null>(null);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [showReplace, setShowReplace] = useState(false);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);

  const isManager = Boolean(user && ['admin', 'manager', 'gerant'].includes(user.role));

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [budgetResult, summaryResult, purchasesResult] = await Promise.all([
        apiClient.getBudget(projectId),
        apiClient.getFinancialSummary(projectId),
        apiClient.listPurchases(projectId),
      ]);
      setBudget(budgetResult);
      setSummary(summaryResult);
      setPurchases(purchasesResult);
    } catch (requestError) {
      setError(isApiError(requestError) ? requestError : { code: 'SERVER_ERROR', message: 'Une erreur est survenue. Réessayez.', status: 500 });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void reload(); }, [reload]);

  const hasBudget = budget && budget.status !== 'missing' && budget.total > 0;

  return (
    <section className="budget-panel register-section" id="budget" aria-label="Budget de chantier">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Financier</span>
          <h2>Budget de chantier</h2>
        </div>
      </div>

      {loading ? <div className="project-page-loading" role="status">Chargement du budget…</div> : null}
      {error ? <ErrorState title="Impossible de charger le budget." message={error.message} onRetry={reload} /> : null}

      {!loading && !error ? (
        hasBudget ? (
          <>
            <div className="budget-stat-grid">
              <div className="record-panel"><span>Total devis</span><strong>{formatCurrency(budget!.total)}</strong><small>{budget?.devisNumber ? `Devis ${budget.devisNumber}` : 'Devis confirmé'}</small></div>
              <div className="record-panel"><span>Dépensé</span><strong>{formatCurrency(summary?.spent ?? 0)}</strong><small>Factures + main-d&apos;œuvre validée</small></div>
              <div className="record-panel"><span>Restant</span><strong>{summary?.remaining != null ? formatCurrency(summary.remaining) : '—'}</strong><small>{budget?.client ? `Client : ${budget.client}` : ' '}</small></div>
            </div>

            {summary ? (
              <ul className="budget-breakdown">
                {PURCHASE_CATEGORIES.map((category) => (
                  <li key={category}><span>{formatPurchaseCategory(category)}</span><strong>{formatCurrency(summary.breakdown[category])}</strong></li>
                ))}
                <li><span>Main-d&apos;œuvre approuvée</span><strong>{formatCurrency(summary.breakdown.approvedLabor)}</strong></li>
              </ul>
            ) : null}

            {budget?.sourceFile ? (
              <a className="button secondary" href={`/api/projects/${encodeURIComponent(projectId)}/budget/document`} target="_blank" rel="noreferrer">Voir le devis (PDF)</a>
            ) : null}

            {isManager ? (
              <div className="budget-subsection">
                <button type="button" className="button secondary" onClick={() => setShowReplace((value) => !value)}>
                  {showReplace ? 'Annuler' : 'Remplacer le devis'}
                </button>
                {showReplace ? <DevisUploadForm projectId={projectId} replacing onDone={() => { setShowReplace(false); void reload(); }} /> : null}
              </div>
            ) : null}

            <div className="budget-subsection">
              <div className="section-heading">
                <h3>Factures</h3>
                {isManager ? (
                  <button type="button" className="button secondary" onClick={() => setShowPurchaseForm((value) => !value)}>
                    {showPurchaseForm ? 'Annuler' : 'Ajouter une facture'}
                  </button>
                ) : null}
              </div>
              {isManager && showPurchaseForm ? <PurchaseUploadForm projectId={projectId} onDone={() => { setShowPurchaseForm(false); void reload(); }} /> : null}
              {purchases.length === 0 ? (
                <p className="field-hint">Aucune facture enregistrée pour ce chantier.</p>
              ) : (
                <div className="project-register-wrap">
                  <table className="project-register">
                    <thead>
                      <tr><th>Catégorie</th><th>Fournisseur</th><th>Description</th><th>Montant</th><th>Date</th><th /></tr>
                    </thead>
                    <tbody>
                      {purchases.map((purchase) => (
                        <tr key={purchase.id}>
                          <td>{formatPurchaseCategory(purchase.category)}</td>
                          <td>{purchase.supplier}</td>
                          <td>{purchase.description}</td>
                          <td>{formatCurrency(purchase.amount)}</td>
                          <td>{new Date(purchase.purchaseDate).toLocaleDateString('fr-FR')}</td>
                          <td className="project-row-action">
                            {purchase.invoiceKey ? (
                              <a href={`/api/projects/${encodeURIComponent(projectId)}/purchases/${encodeURIComponent(purchase.id)}/invoice`} target="_blank" rel="noreferrer">PDF</a>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : isManager ? (
          <DevisUploadForm projectId={projectId} replacing={false} onDone={reload} />
        ) : (
          <EmptyState title="Aucun budget n'a encore été défini pour ce chantier." description="Un responsable doit d'abord importer le devis pour activer le suivi budgétaire." />
        )
      ) : null}
    </section>
  );
}
