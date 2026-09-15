import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'IBRA-BA',
  description: 'Digital compliance, quality control and project documentation for construction professionals.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
