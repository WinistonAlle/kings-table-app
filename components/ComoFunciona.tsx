import { Rotulo, Secao, Titulo, Realce } from './Secao';

/* Como funciona, em três passos.
 *
 * Três e não sete: a promessa da página é "a parte chata some", e uma lista
 * longa de etapas contradiz a promessa antes de a pessoa testar. O que vem
 * depois, na seção de recursos, é detalhe para quem já se convenceu.
 */

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

export function ComoFunciona() {
  return (
    <Secao id="como-funciona" className="py-24 lg:py-32">
      <div className="max-w-2xl">
        <Rotulo>Depois</Rotulo>
        <Titulo>
          Três passos, e a noite <Realce>cuida de si</Realce>.
        </Titulo>
      </div>

      <div className="mt-16 grid gap-8 md:grid-cols-3 lg:gap-10">
        {PASSOS.map((p) => (
          <div key={p.n} className="relative">
            <span
              aria-hidden
              className="titulo t-ornamento block text-gold700"
            >
              {p.n}
            </span>
            <h3 className="titulo mt-4 t-sub text-gold200">{p.titulo}</h3>
            <p className="mt-3 t-apoio text-text2">
              {p.texto}
            </p>
          </div>
        ))}
      </div>
    </Secao>
  );
}
