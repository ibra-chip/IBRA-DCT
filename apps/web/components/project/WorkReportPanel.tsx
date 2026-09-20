'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Field } from '../ui/Field';
import { apiClient } from '../../lib/api-client';
import type { ApiError, ApiUser, QuantityUnit, SituationSummary, WorkReport } from '../../lib/api-types';
import { formatCurrency, formatQuantityUnit } from '../../lib/formatters';

const isApiError = (value: unknown): value is ApiError =>
  typeof value === 'object' && value !== null && 'message' in value;

const errorMessage = (value: unknown, fallback: string) => (isApiError(value) ? value.message : fallback);

interface Coordinates {
  latitude: number;
  longitude: number;
}

function useGeolocation() {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setError('Position GPS refusée ou indisponible. Autorisez la localisation pour continuer.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }, []);

  return { coords, locating, error, locate };
}

function ReportForm({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>('m2');
  const [quantity, setQuantity] = useState('');
  const [quantitySource, setQuantitySource] = useState<'ai' | 'manual'>('manual');
  const [aiAnswer, setAiAnswer] = useState('');
  const [estimating, setEstimating] = useState(false);
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [unitRate, setUnitRate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { coords, locating, error: gpsError, locate } = useGeolocation();

  async function handleEstimate() {
    if (!photo) {
      setError('Sélectionnez une photo du travail effectué.');
      return;
    }
    setEstimating(true);
    setError('');
    try {
      const result = await apiClient.estimateQuantity(projectId, photo, quantityUnit);
      setAiAnswer(result.answer);
      if (result.estimatedQuantity != null) {
        setQuantity(String(result.estimatedQuantity));
        setQuantitySource('ai');
      }
    } catch (requestError) {
      setError(errorMessage(requestError, "Impossible d'estimer la quantité. Réessayez."));
    } finally {
      setEstimating(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photo) {
      setError('Sélectionnez une photo du travail effectué.');
      return;
    }
    if (!coords) {
      setError('Autorisez la position GPS avant de continuer.');
      return;
    }
    const quantityValue = Number(quantity);
    const unitRateValue = Number(unitRate);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setError('Indiquez la quantité réalisée (estimée ou mesurée).');
      return;
    }
    if (!Number.isFinite(unitRateValue) || unitRateValue <= 0) {
      setError('Indiquez le prix unitaire.');
      return;
    }
    if (!description.trim() || !locationName.trim()) {
      setError('Description et lieu sont requis.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const now = new Date();
      await apiClient.createWorkReport(projectId, {
        photo,
        description: description.trim(),
        date: now.toISOString().slice(0, 10),
        capturedAt: now.toISOString(),
        locationName: locationName.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        quantityUnit,
        quantity: quantityValue,
        unitRate: unitRateValue,
        m2Source: quantitySource,
      });
      setPhoto(null);
      setQuantity('');
      setAiAnswer('');
      setDescription('');
      setLocationName('');
      setUnitRate('');
      setQuantitySource('manual');
      onDone();
    } catch (requestError) {
      setError(errorMessage(requestError, "Impossible d'enregistrer le rapport."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="budget-form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="report-photo">Photo du travail effectué</label>
        <input
          id="report-photo"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={submitting}
          onChange={(event) => { setPhoto(event.target.files?.[0] ?? null); setAiAnswer(''); }}
        />
      </div>

      <div className="field">
        <label htmlFor="report-unit">Unité</label>
        <select
          id="report-unit"
          value={quantityUnit}
          disabled={submitting}
          onChange={(event) => { setQuantityUnit(event.target.value as QuantityUnit); setQuantity(''); setAiAnswer(''); }}
        >
          <option value="m2">m² (surface)</option>
          <option value="ml">ml (longueur)</option>
        </select>
      </div>

      <Button type="button" className="secondary" disabled={!photo || estimating || submitting} onClick={handleEstimate}>
        {estimating ? 'Analyse en cours…' : `Estimer les ${formatQuantityUnit(quantityUnit)} avec l'IA`}
      </Button>
      {aiAnswer ? <p className="field-hint">{aiAnswer}</p> : null}

      <Field
        label={`Quantité réalisée (${formatQuantityUnit(quantityUnit)})`}
        name="quantity"
        type="number"
        min="0"
        step="0.01"
        value={quantity}
        onChange={(event) => { setQuantity(event.target.value); setQuantitySource('manual'); }}
        disabled={submitting}
        hint={quantitySource === 'ai' ? 'Valeur proposée par IA — modifiable' : 'Saisie manuelle'}
        required
      />

      <Field label="Prix unitaire (€)" name="unitRate" type="number" min="0" step="0.01" value={unitRate} onChange={(event) => setUnitRate(event.target.value)} disabled={submitting} required />
      <Field label="Description du travail" name="description" value={description} onChange={(event) => setDescription(event.target.value)} disabled={submitting} required />
      <Field label="Lieu (zone du chantier)" name="locationName" value={locationName} onChange={(event) => setLocationName(event.target.value)} disabled={submitting} required />

      <div className="field">
        <label>Position GPS</label>
        {coords ? (
          <p className="field-hint">Position obtenue ({coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)})</p>
        ) : (
          <Button type="button" className="secondary" disabled={locating || submitting} onClick={locate}>
            {locating ? 'Localisation…' : 'Obtenir ma position GPS'}
          </Button>
        )}
        {gpsError ? <p className="field-error">{gpsError}</p> : null}
      </div>

      {error ? <p className="form-alert" role="alert">{error}</p> : null}
      <Button type="submit" className="primary" disabled={submitting}>
        {submitting ? 'Enregistrement…' : 'Soumettre le rapport'}
      </Button>
    </form>
  );
}

export function WorkReportPanel({ projectId, user }: { projectId: string; user?: ApiUser }) {
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [summary, setSummary] = useState<SituationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [showForm, setShowForm] = useState(false);

  const isManager = Boolean(user && ['admin', 'manager', 'gerant'].includes(user.role));

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportsResult, summaryResult] = await Promise.all([
        apiClient.listWorkReports(projectId),
        apiClient.getSituationSummary(projectId),
      ]);
      setReports(reportsResult);
      setSummary(summaryResult);
    } catch (requestError) {
      setError(isApiError(requestError) ? requestError : { code: 'SERVER_ERROR', message: 'Une erreur est survenue. Réessayez.', status: 500 });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void reload(); }, [reload]);

  async function handleStatus(reportId: string, status: 'approved' | 'rejected') {
    try {
      await apiClient.updateWorkReportStatus(projectId, reportId, status);
      await reload();
    } catch {
      // surfaced on next list refresh
    }
  }

  return (
    <section className="budget-panel register-section" id="rapports" aria-label="Rapports de chantier">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Productivité</span>
          <h2>Rapports de chantier</h2>
        </div>
        <button type="button" className="button secondary" onClick={() => setShowForm((value) => !value)}>
          {showForm ? 'Annuler' : 'Nouveau rapport'}
        </button>
      </div>

      {showForm ? <ReportForm projectId={projectId} onDone={() => { setShowForm(false); void reload(); }} /> : null}

      {loading ? <div className="project-page-loading" role="status">Chargement des rapports…</div> : null}
      {error ? <ErrorState title="Impossible de charger les rapports." message={error.message} onRetry={reload} /> : null}

      {!loading && !error ? (
        <>
          {summary ? (
            <div className="budget-stat-grid">
              <div className="record-panel"><span>Surface (mois)</span><strong>{summary.quantityM2.toFixed(2)} m²</strong><small>{summary.reportCount} rapport{summary.reportCount === 1 ? '' : 's'} approuvé{summary.reportCount === 1 ? '' : 's'}</small></div>
              <div className="record-panel"><span>Longueur (mois)</span><strong>{summary.quantityMl.toFixed(2)} ml</strong><small> </small></div>
              <div className="record-panel"><span>Montant (mois)</span><strong>{summary.amount != null ? formatCurrency(summary.amount) : '—'}</strong><small> </small></div>
            </div>
          ) : null}

          {reports.length === 0 ? (
            <EmptyState title="Aucun rapport pour le moment." description="Ajoutez un rapport avec une photo pour suivre l'avancement quotidien." />
          ) : (
            <div className="project-register-wrap">
              <table className="project-register">
                <thead>
                  <tr><th>Date</th><th>Lieu</th><th>Description</th><th>Quantité</th><th>Statut</th><th /></tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id}>
                      <td>{new Date(report.date).toLocaleDateString('fr-FR')}</td>
                      <td>{report.locationName}</td>
                      <td>{report.description}</td>
                      <td>{report.quantity.toFixed(2)} {formatQuantityUnit(report.quantityUnit)}</td>
                      <td>{report.status}</td>
                      <td className="project-row-action">
                        {isManager && report.status === 'pending' ? (
                          <>
                            <button type="button" onClick={() => handleStatus(report.id, 'approved')}>✓</button>
                            <button type="button" onClick={() => handleStatus(report.id, 'rejected')}>✗</button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
