'use client';

import { useCallback, useEffect, useState } from 'react';

import { apiClient } from '../lib/api-client';
import type { ApiError, DashboardData, ValidationTask } from '../lib/api-types';

interface DashboardState {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: DashboardData | null;
  error: ApiError | null;
}

const isApiError = (value: unknown): value is ApiError => (
  typeof value === 'object'
  && value !== null
  && 'status' in value
  && 'message' in value
);

const getValidationTasks = (projects: DashboardData['projects']): ValidationTask[] => projects.flatMap((project) => (
  project.checklists?.flatMap((checklist) => checklist.items
    .filter((item) => item.status !== 'complete')
    .map((item) => ({
      id: item.id,
      title: item.title,
      projectId: project.id,
      projectName: project.name,
      status: item.status,
      assignedTo: item.assignedTo,
    }))) ?? []
));

export function useDashboardData() {
  const [state, setState] = useState<DashboardState>({ status: 'idle', data: null, error: null });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const [user, projects] = await Promise.all([apiClient.me(), apiClient.projects()]);
      setState({
        status: 'success',
        error: null,
        data: { user, projects, validationTasks: getValidationTasks(projects) },
      });
    } catch (error) {
      setState({
        status: 'error',
        data: null,
        error: isApiError(error)
          ? error
          : { code: 'SERVER_ERROR', message: 'Une erreur est survenue. Réessayez.', status: 500 },
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, retry: load };
}
