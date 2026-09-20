import Image from 'next/image';
import Link from 'next/link';

import { ContactBand } from '../components/public/ContactBand';
import { HeroRegisterPreview } from '../components/public/HeroRegisterPreview';
import { WorkflowRegister } from '../components/public/WorkflowRegister';

export default function HomePage() {
  return (
    <main className="public-shell">
      <header className="topbar">
        <div className="container public-nav">
          <Link className="brand" href="/">IBRA-BA</Link>
          <nav className="navlinks" aria-label="Navigation publique">
            <a href="#about">À propos</a>
            <a href="#features">Fonctionnalités</a>
            <a href="#contact">Contact</a>
          </nav>
          <Link className="button secondary" href="/login">Accéder à la démo</Link>
        </div>
      </header>

      <section className="public-hero">
        <div className="container">
          <div className="hero-copy-grid">
            <div className="hero-copy">
              <span className="eyebrow">Digital compliance</span>
              <h1>Conformité digitale, contrôle qualité et documentation de chantier.</h1>
              <p className="lead">Centralisez les plans, documents et preuves de chantier, validez chaque étape de travail et utilisez l’IA pour analyser la documentation technique avec confiance.</p>
            </div>
            <div className="hero-actions">
              <Link className="button primary" href="/login">Demander une démo</Link>
              <p>Une vue de travail structurée pour les équipes terrain et les responsables de projet.</p>
            </div>
          </div>
          <HeroRegisterPreview />
        </div>
      </section>

      <section id="about" className="section about-section">
        <div className="container about-grid">
          <h2>Une plateforme pensée pour la conformité et la traçabilité.</h2>
          <p>IBRA-BA aide les entreprises du bâtiment à centraliser la documentation de projet, le contrôle qualité et la conformité dans un espace numérique unique et sécurisé.</p>
        </div>
      </section>

      <section id="features" className="section workflow-section">
        <div className="container">
          <div className="section-head left-align">
            <div>
              <span className="section-kicker">Fonctionnalités</span>
              <h2>Du chantier au dossier de preuves.</h2>
            </div>
            <p>Chaque registre relie l’action terrain à la pièce qui permet de la vérifier.</p>
          </div>
          <WorkflowRegister />
          <div className="documentary-detail">
            <Image src="https://images.pexels.com/photos/8488033/pexels-photo-8488033.jpeg?auto=compress&cs=tinysrgb&w=1400" width={1400} height={933} sizes="(max-width: 640px) 100vw, 60vw" alt="Main gantée mesurant une couche de façade sur un chantier — photo de Kindel Media sur Pexels." />
            <p>La preuve reste attachée à son contexte, sa phase et son responsable.</p>
          </div>
        </div>
      </section>

      <section id="contact" className="section contact-section">
        <div className="container"><ContactBand /></div>
      </section>
    </main>
  );
}
