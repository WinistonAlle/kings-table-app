import { Rotulo, Secao, Titulo, Realce } from './Secao';

/* Antes e depois, numa dobra só.
 *
 * Isto eram duas seções: "A dor" (rótulo Antes, cinco cenas) e "Como funciona"
 * (rótulo Depois, três passos). Dois títulos, dois blocos de respiro, duas
 * molduras — para sustentar UM argumento: hoje é assim, com o app é assado.
 *
 * Separadas, a virada acontecia num vão de 200px entre seções, que é o lugar
 * onde ela não acontece. Juntas, a frase de charneira fica encostada nas cenas
 * que a justificam e a resposta vem logo abaixo, ainda na mesma respiração.
 *
 * O conteúdo não foi cortado: o que saiu foi a duplicação de moldura.
 */

const CENAS = [
  {
    quando: '21h40',
    titulo: 'Alguém pergunta quanto está o blind',
    texto:
      'O cronômetro é o celular de alguém. Bloqueou a tela, o app parou, e ninguém sabe há quanto tempo.',
  },
  {
    quando: '22h15',
    titulo: 'O terceiro rebuy da noite',
    texto:
      'Anotado no verso de um papel, ou não anotado. No fim o bolo não fecha, e alguém cede.',
  },
  {
    quando: '23h30',
    titulo: '"Eu já te paguei?"',
    texto:
      'Metade pagou por PIX, metade paga na saída, um paga semana que vem. Você virou cobrador.',
  },
  {
    quando: '01h00',
    titulo: 'Quem ganhou o quê',
    texto:
      'Premiação calculada no grito, com gente cansada. A discussão continua no grupo até quarta.',
  },
  {
    quando: 'na quarta seguinte',
    titulo: 'Ninguém sabe quem está na frente',
    texto: 'Sem ranking, não existe campeonato. Só uma sequência de noites soltas.',
  },
];

const PASSOS = [
  {
    n: '01',
    titulo: 'Abra a mesa',
    texto:
      'Nome, buy-in e o ritmo dos blinds. Leva menos tempo do que abrir a planilha que você usa hoje.',
  },
  {
    n: '02',
    titulo: 'Jogue a noite',
    texto:
      'O relógio corre sozinho, mesmo com o celular no bolso. Você marca quem pagou, quem recomprou e quem caiu, um toque por vez.',
  },
  {
    n: '03',
    titulo: 'Feche e esqueça',
    texto:
      'Quando sobra um, o torneio fecha sozinho: posições atribuídas, premiação calculada e ranking da temporada atualizado.',
  },
];

export function AntesDepois() {
  return (
    <Secao id="como-funciona" className="py-24 lg:py-32">
      <div className="max-w-2xl">
        <Rotulo>A noite de hoje</Rotulo>
        <Titulo>
          A mesa é boa. A <Realce>organização</Realce> é que cansa.
        </Titulo>
      </div>

      <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
        {CENAS.map((c) => (
          <li key={c.titulo} className="bg-bg1 p-7 lg:p-8">
            <p className="font-mono t-micro tracking-wide text-gold500">{c.quando}</p>
            <h3 className="titulo mt-3 t-card text-gold200">{c.titulo}</h3>
            <p className="mt-3 t-apoio text-text2">{c.texto}</p>
          </li>
        ))}

        {/* A charneira. Ela fecha a fileira das cenas e abre a resposta, e é
            por estar ENCOSTADA nas duas que ela funciona. */}
        <li className="flex items-center bg-bg1 p-7 lg:p-8">
          <p className="titulo t-sub text-gold200">
            Nada disso é sobre pôquer. É sobre planilha.
          </p>
        </li>
      </ol>

      {/* A faixa larga no desktop não é respiro decorativo: é o lugar da
          ficha. Ela para aqui, à direita, com o anel de texto girando em
          volta (ver `POSE_PAUSA` em Ficha3D.tsx), e o anel tem ~350px de
          diâmetro. Sem a faixa, ele cai em cima do texto do terceiro passo.
          No celular a cena 3D nem existe, então lá vale o respiro normal. */}
      <div className="mt-20 max-w-2xl lg:mt-[22rem]">
        <Rotulo>Com o King&apos;s Table</Rotulo>
        <Titulo>
          Três passos, e a noite <Realce>cuida de si</Realce>.
        </Titulo>
      </div>

      <div className="mt-14 grid gap-8 md:grid-cols-3 lg:gap-10">
        {PASSOS.map((p) => (
          <div key={p.n} className="relative">
            <span aria-hidden className="titulo t-ornamento block text-gold700">
              {p.n}
            </span>
            <h3 className="titulo mt-4 t-sub text-gold200">{p.titulo}</h3>
            <p className="mt-3 t-apoio text-text2">{p.texto}</p>
          </div>
        ))}
      </div>
    </Secao>
  );
}
