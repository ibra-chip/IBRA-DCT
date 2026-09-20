import Link from 'next/link';

export function ContactBand() {
  return (
    <div className="contact-band">
      <div>
        <span className="section-kicker">Contact</span>
        <h2>Construisez un dossier de chantier plus clair.</h2>
      </div>
      <Link className="button primary" href="mailto:hello@ibra-ba.net">Demander une démonstration</Link>
    </div>
  );
}
