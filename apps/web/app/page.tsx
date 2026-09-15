const features = [
  {
    title: 'Gestion de projet',
    description: 'Créez et gérez vos projets, attribuez les responsabilités et reliez chaque activité à un contexte opérationnel clair.',
  },
  {
    title: 'Gestion documentaire',
    description: 'Téléchargez les plans, PDF et fichiers techniques dans un environnement structuré et traçable.',
  },
  {
    title: 'Preuves de chantier',
    description: 'Capturez des photos avant, pendant et après les travaux pour documenter chaque phase avec des preuves claires.',
  },
  {
    title: 'Contrôle qualité',
    description: 'Utilisez des checklists structurés pour valider l’exécution et identifier les écarts avant qu’ils ne deviennent critiques.',
  },
  {
    title: 'Analyse assistée par IA',
    description: 'Posez des questions techniques à partir des documents du projet et obtenez des réponses fondées sur vos propres données.',
  },
  {
    title: 'Conformité et reporting',
    description: 'Préparez un dossier complet et vérifiable pour les audits, revues de conformité et suivis de chantier.',
  },
];

export default function HomePage() {
  return (
    <main>
      <header className="topbar">
        <div className="container nav">
          <div className="brand">IBRA-BA</div>
          <nav className="navlinks">
            <a href="#about">A propos</a>
            <a href="#features">Fonctionnalités</a>
            <a href="#contact">Contact</a>
          </nav>
          <a className="button secondary" href="/login">Accéder à la démo</a>
        </div>
      </header>

      <section className="hero">
        <div className="container heroGrid">
          <div>
            <span className="eyebrow">Digital compliance</span>
            <h1>Conformité digitale, contrôle qualité et documentation de chantier.</h1>
            <p className="lead">
              Centralisez les plans, documents et preuves de chantier, validez chaque étape de travail et utilisez l’IA pour analyser la documentation technique avec confiance.
            </p>
            <div className="ctaRow">
              <a className="button primary" href="/login">Demander une démo</a>
              <a className="button secondary" href="/dashboard">Découvrir le dashboard</a>
            </div>
            <div className="pillRow">
              <span>RGE / Qualibat</span>
              <span>ITE & Bardage</span>
              <span>Evidence tracking</span>
            </div>
          </div>

          <div className="statsCard">
            <div className="stat">
              <span>Projets suivis</span>
              <strong>1,200+</strong>
            </div>
            <div className="stat">
              <span>Contrôles conformité</span>
              <strong>98%</strong>
            </div>
            <div className="stat">
              <span>Analyses IA</span>
              <strong>24/7</strong>
            </div>
            <div className="stat">
              <span>Dossiers traçables</span>
              <strong>100%</strong>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="section">
        <div className="container narrow">
          <h2>Une plateforme pensée pour la conformité et la traçabilité</h2>
          <p>
            IBRA-BA aide les entreprises du bâtiment à centraliser la documentation de projet, le contrôle qualité et la conformité dans un espace numérique unique et sécurisé.
          </p>
        </div>
      </section>

      <section id="features" className="section">
        <div className="container">
          <div className="sectionHead">
            <h2>Fonctionnalités clés</h2>
            <p>Une solution conçue pour les équipes terrain, conducteurs de travaux et gestionnaires de projet.</p>
          </div>

          <div className="grid">
            {features.map((feature) => (
              <article key={feature.title} className="featureCard">
                <div className="icon">✦</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="section">
        <div className="container">
          <div className="ctaBand">
            <h2>Commencez à piloter la conformité de vos projets avec confiance.</h2>
            <a className="button primary" href="mailto:hello@ibra-ba.net">Demandez une démonstration</a>
          </div>
        </div>
      </section>
    </main>
  );
}
