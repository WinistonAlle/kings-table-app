import { Rotulo, Secao, Titulo, Realce } from './Secao';

/* Os recursos.
 *
 * Cada um está escrito pelo que RESOLVE, não pelo que é. "Relógio de blinds"
 * é categoria; "não atrasa quando você bloqueia a tela" é a razão de alguém
 * trocar o cronômetro que já tem. Só entram coisas que o app faz hoje — o que
 * está por vir mora na seção seguinte, marcado como tal.
 */

const RECURSOS = [
  {
    titulo: 'O relógio não atrasa',
    texto:
      'Ancorado no relógio de parede, não num contador. Bloqueie a tela, feche o app, volte uma hora depois: o nível é o certo.',
  },
  {
    titulo: 'Quem pagou, sem você virar cobrador',
    texto:
      'A receber, pago, contestado. Reentrada e add-on entram sozinhos no bolo.',
  },
  {
    titulo: 'A premiação sai calculada',
    texto:
      'As faixas acompanham o tamanho do campo. No fim, cada posição já tem o prêmio gravado.',
  },
  {
    titulo: 'O ranking existe',
    texto:
      'Pontos por posição e tamanho de campo, vitórias, ITM e saldo. Atualizado a cada noite.',
  },
  {
    titulo: 'Eliminação com um toque',
    texto:
      'Caiu com sete na mesa, terminou em sétimo. A última eliminação fecha o torneio sozinha.',
  },
  {
    titulo: 'Funciona sem sinal',
    texto:
      'Sala sem Wi-Fi, celular sem dados, tanto faz. A noite inteira roda no aparelho.',
  },
];

export function Recursos() {
  return (
    <Secao className="py-24 lg:py-32">
      <div className="max-w-2xl">
        <Rotulo>O que ele faz</Rotulo>
        <Titulo>
          Feito por quem <Realce>organiza a mesa</Realce>, não por quem
          imagina uma.
        </Titulo>
      </div>

      {/* Seis cartões iguais, dois por três.
          O primeiro ocupava duas fileiras porque o texto dele era três vezes
          maior que o dos outros. Com os textos encurtados, o mesmo destaque
          virou uma caixa vazia do tamanho de duas: a hierarquia estava sendo
          feita pelo tamanho do parágrafo, não por decisão. */}
      <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {RECURSOS.map((r) => (
          <article key={r.titulo} className="superficie rounded-2xl p-7 lg:p-8">
            <h3 className="titulo t-card text-gold200">{r.titulo}</h3>
            <p className="mt-4 t-apoio text-text2">
              {r.texto}
            </p>
          </article>
        ))}
      </div>
    </Secao>
  );
}
