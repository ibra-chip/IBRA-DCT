'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Field } from '../ui/Field';
import { apiClient } from '../../lib/api-client';
import type { ApiError, Rendezvous } from '../../lib/api-types';

const isApiError = (value: unknown): value is ApiError =>
  typeof value === 'object' && value !== null && 'message' in value;

const errorMessage = (value: unknown, fallback: string) => (isApiError(value) ? value.message : fallback);

function EditRow({ rendezvous, onDone, onCancel }: { rendezvous: Rendezvous; onDone: () => void; onCancel: () => void }) {
  const [absenceDate, setAbsenceDate] = useState(rendezvous.absenceDate.slice(0, 10));
  const [time, setTime] = useState(rendezvous.time);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSubmitting(true);
    setError('');
    try {
      await apiClient.updateRendezvous(rendezvous.projectId, rendezvous.id, { absenceDate, time });
      onDone();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Impossible de modifier ce rendez-vous.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <tr>
      <td><input type="date" value={absenceDate} onChange={(event) => setAbsenceDate(event.target.value)} disabled={submitting} /></td>
      <td><input type="time" value={time} onChange={(event) => setTime(event.target.value)} disabled={submitting} /></td>
      <td colSpan={2}>{error ? <span className="field-error">{error}</span> : null}</td>
      <td className="project-row-action">
        <button type="button" onClick={handleSave} disabled={submitting}>✓</button>
        <button type="button" onClick={onCancel} disabled={submitting}>✗</button>
      </td>
    </tr>
  );
}

function RendezvousForm({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [absenceDate, setAbsenceDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!absenceDate || !time) {
      setError('Date et heure sont requises.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiClient.createRendezvous(projectId, { absenceDate, time, reason: reason.trim() || undefined });
      setAbsenceDate('');
      setTime('');
      setReason('');
      onDone();
    } catch (requestError) {
      setError(errorMessage(requestError, "Impossible d'ajouter ce rendez-vous."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="budget-form" onSubmit={handleSubmit} noValidate>
      <Field label="Date" name="absenceDate" type="date" value={absenceDate} onChange={(event) => setAbsenceDate(event.target.value)} disabled={submitting} required />
      <Field label="Heure" name="time" type="time" value={time} onChange={(event) => setTime(event.target.value)} disabled={submitting} required />
      <Field label="Motif (optionnel)" name="reason" value={reason} onChange={(event) => setReason(event.target.value)} disabled={submitting} />
      {error ? <p className="form-alert" role="alert">{error}</p> : null}
      <Button type="submit" className="primary" disabled={submitting}>
        {submitting ? 'Enregistrement…' : "Ajouter à l'agenda"}
      </Button>
    </form>
  );
}

export function RendezvousPanel({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<Rendezvous[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await apiClient.listRendezvous(projectId));
    } catch (requestError) {
      setError(isApiError(requestError) ? requestError : { code: 'SERVER_ERROR', message: 'Une erreur est survenue. Réessayez.', status: 500 });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void reload(); }, [reload]);

  return (
    <section className="budget-panel register-section" id="agenda" aria-label="Agenda des absences et rendez-vous">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Agenda</span>
          <h2>Absences &amp; rendez-vous</h2>
        </div>
        <button type="button" className="button secondary" onClick={() => setShowForm((value) => !value)}>
          {showForm ? 'Annuler' : 'Nouveau rendez-vous'}
        </button>
      </div>

      {showForm ? <RendezvousForm projectId={projectId} onDone={() => { setShowForm(false); void reload(); }} /> : null}

      {loading ? <div className="project-page-loading" role="status">Chargement…</div> : null}
      {error ? <ErrorState title="Impossible de charger l'agenda." message={error.message} onRetry={reload} /> : null}

      {!loading && !error ? (
        items.length === 0 ? (
          <EmptyState title="Aucun rendez-vous planifié." description="Ajoutez une absence ou un rendez-vous au moins 3 jours à l'avance." />
        ) : (
          <div className="project-register-wrap">
            <table className="project-register">
              <thead>
                <tr><th>Date</th><th>Heure</th><th>Motif</th><th>Statut</th><th /></tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  editingId === item.id ? (
                    <EditRow key={item.id} rendezvous={item} onCancel={() => setEditingId(null)} onDone={() => { setEditingId(null); void reload(); }} />
                  ) : (
                    <tr key={item.id}>
                      <td>{new Date(item.absenceDate).toLocaleDateString('fr-FR')}</td>
                      <td>{item.time}</td>
                      <td>{item.reason || '—'}</td>
                      <td>{item.status}</td>
                      <td className="project-row-action">
                        <button type="button" onClick={() => setEditingId(item.id)}>Modifier</button>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </section>
  );
}
