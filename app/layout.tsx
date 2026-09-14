import type { Metadata } from 'next';
import { Sora, Inter_Tight, DM_Mono } from 'next/font/google';
import './globals.css';
import { RolagemSuave } from '@/components/RolagemSuave';

/* Três famílias, três papéis: Sora é a voz da marca nos títulos, Inter
   Tight é interface e texto corrido, DM Mono são os algarismos. */
/* Sora nos títulos. Sem serifa, e com peso de verdade.
 *
 * Passou por duas trocas até chegar aqui, e as duas por motivos diferentes:
 *
 * - **Cormorant Garamond** era uma garalda, desenhada para corpo de texto em
 *   livro. Em título de 4rem sobre preto ela sumia: o traço não tinha peso
 *   para segurar a página.
 * - **Playfair Display** resolvia o peso, mas continuava serifada, e serifa
 *   não é o caminho deste produto.
 *
 * A Sora é geométrica, fecha em 800 com haste realmente grossa, e tem
 * personalidade própria o bastante para não se confundir com a Inter Tight do
 * texto corrido — que era o risco de escolher outra grotesca qualquer. Em
 * preto e ouro ela funciona porque a massa cheia da letra é o que devolve o
 * brilho do ouro; letra fina deixa o dourado virar um fio. */
const display = Sora({
  variable: '--fonte-display',
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
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
