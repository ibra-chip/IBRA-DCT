'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { apiClient } from '../../lib/api-client';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Renseignez votre email et votre mot de passe.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.login({ email: email.trim(), password });
      router.push(nextPath.startsWith('/') ? nextPath : '/dashboard');
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Email ou mot de passe invalide.');
      setSubmitting(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit} noValidate>
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="nom@entreprise.fr"
        disabled={submitting}
        required
      />
      <Field
        label="Mot de passe"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        disabled={submitting}
        required
      />
      {error ? <p className="form-alert" role="alert" aria-live="polite">{error}</p> : null}
      <Button type="submit" className="primary full-width" loading={submitting}>
        Se connecter
      </Button>
    </form>
  );
}
