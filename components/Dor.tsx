import { Rotulo, Secao, Titulo, Realce } from './Secao';

/* A dor.
 *
 * Não é lista de funcionalidade: é a noite como ela acontece hoje. Cada item
 * é uma cena que quem organiza reconhece antes de terminar de ler. Vender
 * software pra quem não sabe que tem um problema começa por nomear o problema
 * com as palavras dele, não com as do produto.
 */

const CENAS = [
  {
    quando: '21h40',
    titulo: 'Alguém pergunta quanto está o blind',
    texto:
      'O cronômetro é o celular de quem lembrou de abrir. Ele bloqueou a tela, o app parou, e ninguém sabe se o nível virou faz cinco minutos ou faz quinze.',
  },
  {
    quando: '22h15',
    titulo: 'O terceiro rebuy da noite',
    texto:
      'Anotado no verso de um papel, ou não anotado. No fim, a conta do bolo não fecha com o que está na mesa, e alguém vai ter que ceder.',
  },
  {
    quando: '23h30',
    titulo: '"Eu já te paguei?"',
    texto:
      'Metade pagou por PIX, metade paga na saída, e um sempre paga semana que vem. Você vira cobrador do seu próprio jogo.',
  },
  {
    quando: '01h00',
    titulo: 'Quem ganhou o quê',
    texto:
      'A premiação é calculada no grito, com gente cansada. Depois a discussão migra para o grupo do WhatsApp, onde nunca termina.',
  },
  {
    quando: 'na quarta seguinte',
    titulo: 'Ninguém sabe quem está na frente',
    texto:
      'A temporada existe só na memória de quem venceu mais vezes. Sem ranking, não há campeonato, só uma sequência de noites soltas.',
  },
];

export function Dor() {
  return (
    <Secao className="py-24 lg:py-32">
      <div className="max-w-2xl">
        <Rotulo>Antes</Rotulo>
        <Titulo>
          A mesa é boa. A <Realce>organização</Realce> é que cansa.
        </Titulo>
      </div>

      <ol className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
        {CENAS.map((c) => (
          <li key={c.titulo} className="bg-bg1 p-7 lg:p-8">
            <p className="font-mono text-[0.72rem] tracking-wide text-gold500">
              {c.quando}
            </p>
            <h3 className="mt-3 text-[1.05rem] font-semibold text-text0">
              {c.titulo}
            </h3>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-text2">
              {c.texto}
            </p>
          </li>
        ))}

        {/* A última célula fecha a fileira e faz a virada para a solução. */}
        <li className="flex items-center bg-bg1 p-7 lg:p-8">
          <p className="titulo text-[1.45rem] text-gold200">
            Nada disso é sobre pôquer. É sobre planilha.
          </p>
        </li>
      </ol>
    </Secao>
  );
}
