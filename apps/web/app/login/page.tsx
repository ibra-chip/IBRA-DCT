import { Suspense } from 'react';

import { LoginForm } from '../../components/auth/LoginForm';
import { DossierBand } from '../../components/ui/DossierBand';

export default function LoginPage() {
  return (
    <main className="login-shell">
      <section className="login-card" aria-label="Connexion">
        <div className="login-brand">
          <span className="app-brand-mark">I</span>
          <span>IBRA-BA</span>
        </div>
        <DossierBand title="Connexion" metadata={<span>Accédez à votre espace projet et conformité.</span>} />
        <Suspense fallback={<div className="login-loading" role="status">Chargement…</div>}>
          <LoginForm />
        </Suspense>
        <p className="login-footnote">Utilisez les identifiants fournis par votre entreprise.</p>
      </section>
    </main>
  );
}
