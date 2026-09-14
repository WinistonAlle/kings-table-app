import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter_Tight, DM_Mono } from 'next/font/google';
import './globals.css';
import { RolagemSuave } from '@/components/RolagemSuave';

/* As mesmas três famílias do app, pelos mesmos papéis: serifa é a voz do
   clube, Inter Tight é interface, DM Mono são os algarismos. */
const display = Cormorant_Garamond({
  variable: '--fonte-display',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
});

const ui = Inter_Tight({
  variable: '--fonte-ui',
  subsets: ['latin'],
});

const mono = DM_Mono({
  variable: '--fonte-mono',
  subsets: ['latin'],
  weight: ['300', '400', '500'],
});

const SITE = 'https://kingstable.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "King's Table: o seu home game, organizado",
  description:
    'Relógio de blinds, controle de quem pagou, premiação calculada e ranking da temporada. O aplicativo que substitui a planilha e a discussão no grupo.',
  openGraph: {
    title: "King's Table: o seu home game, organizado",
    description:
      'Relógio de blinds, controle de quem pagou, premiação calculada e ranking da temporada.',
    url: SITE,
    siteName: "King's Table",
    locale: 'pt_BR',
    type: 'website',
  },
  icons: { icon: '/marca/coroa.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${ui.variable} ${mono.variable}`}>
      <body>
        <RolagemSuave />
        {children}
      </body>
    </html>
  );
}
