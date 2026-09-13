import { Marca } from './Marca';
import { BotaoOuro, Filete } from './Secao';

/* O topo.
 *
 * A promessa está na primeira linha e é concreta: não "gestão de torneios",
 * mas o que a pessoa faz na quarta à noite. Quem organiza home game não está
 * procurando software — está cansado de uma situação. A frase tem que
 * descrever a situação.
 */
export function Topo() {
  return (
    <header className="grao relative w-full overflow-hidden">
      {/* Clarão quente no alto, como luminária sobre a mesa. É o que dá direção
          à luz — sem fonte definida, nenhuma sombra depois faz sentido. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[640px]"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(196,156,92,0.16), transparent 70%)',
        }}
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-6 pt-20 pb-24 text-center lg:px-10 lg:pt-28 lg:pb-32">
        <Marca className="w-[104px] text-gold400 lg:w-[124px]" />

        <h1 className="titulo mt-10 max-w-4xl text-[clamp(2.4rem,6vw,4.4rem)] text-balance text-text0">
          O seu home game merece mais que{' '}
          <em className="text-gold300 not-italic">uma planilha</em> e{' '}
          <em className="text-gold300 not-italic">boa memória</em>.
        </h1>

        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-text1 lg:text-xl">
          Relógio de blinds que não atrasa, controle de quem pagou, premiação
          calculada na hora e o ranking da temporada saindo sozinho de cada
          noite. O King&apos;s Table cuida da parte chata para você voltar a
          jogar a sua própria mesa.
        </p>

        <div className="mt-11 flex flex-wrap items-center justify-center gap-3">
          <BotaoOuro href="#precos">Abrir o meu clube</BotaoOuro>
          <a
            href="#como-funciona"
            className="inline-flex items-center gap-2 rounded-full border border-lineStrong px-7 py-3.5 text-[0.95rem] font-medium text-text1 transition-colors hover:border-gold500 hover:text-text0"
          >
            Ver como funciona
          </a>
        </div>

        <div className="mt-14">
          <Filete largura={132} />
        </div>
      </div>
    </header>
  );
}
