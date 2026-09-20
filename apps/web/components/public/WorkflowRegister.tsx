const workflows = [
  {
    index: '01',
    title: 'Pilotage du projet',
    items: [
      ['Gestion de projet', 'Centralisez les responsabilités, les lieux et les étapes du chantier.'],
      ['Gestion documentaire', 'Retrouvez les plans et fichiers techniques dans un registre traçable.'],
    ],
  },
  {
    index: '02',
    title: 'Preuves et qualité',
    items: [
      ['Preuves de chantier', 'Documentez chaque phase par des photos et des pièces associées.'],
      ['Contrôle qualité', 'Validez les points sensibles avant qu’ils ne deviennent critiques.'],
    ],
  },
  {
    index: '03',
    title: 'Analyse et conformité',
    items: [
      ['Analyse assistée par IA', 'Interrogez vos documents en gardant la source au centre de la réponse.'],
      ['Conformité et reporting', 'Préparez un dossier clair pour les revues et audits de chantier.'],
    ],
  },
] as const;

export function WorkflowRegister() {
  return (
    <div className="workflow-register">
      {workflows.map((workflow) => (
        <section className="workflow-band" key={workflow.index}>
          <div className="workflow-index">{workflow.index}</div>
          <div className="workflow-title">{workflow.title}</div>
          <div className="workflow-items">
            {workflow.items.map(([title, description]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
          <span className="dossier-fasteners" aria-hidden="true" />
        </section>
      ))}
    </div>
  );
}
