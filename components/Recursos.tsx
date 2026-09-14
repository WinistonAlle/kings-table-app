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
      'Ele é ancorado no relógio de parede, não num contador. Bloqueie a tela, atenda o telefone, feche o app: quando voltar, o nível é o certo. Se passou tempo demais, ele já pulou os níveis que passaram, em vez de recuperar um a um na frente da mesa.',
    destaque: true,
  },
  {
    titulo: 'Quem pagou, sem você virar cobrador',
    texto:
      'Cada jogador tem o estado dele: a receber, pago, contestado. Reentrada e add-on contam sozinhos no bolo, então a conta fecha com o que está na mesa.',
  },
  {
    titulo: 'A premiação sai calculada',
    texto:
      'As faixas mudam com o tamanho do campo, e o valor é recalculado a cada entrada. Quando o torneio acaba, cada posição já tem o prêmio gravado, somando o bolo exato.',
  },
  {
    titulo: 'O ranking existe',
    texto:
      'A temporada deixa de viver na memória de quem venceu mais. Pontos por posição e tamanho de campo, vitórias, ITM e saldo, atualizados a cada noite que termina.',
  },
  {
    titulo: 'Eliminação com um toque',
    texto:
      'Caiu com sete na mesa, terminou em sétimo. A última eliminação fecha o torneio sozinha. E tem desfazer, porque erro de dedo acontece, e acontece na mesa.',
  },
  {
    titulo: 'Funciona sem sinal',
    texto:
      'A noite inteira roda no aparelho. Sala sem Wi-Fi, celular sem dados, tanto faz: nada depende de conexão para o torneio andar.',
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

      <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {RECURSOS.map((r) => (
          <article
            key={r.titulo}
            className={`superficie rounded-2xl p-7 lg:p-8 ${
              r.destaque ? 'md:col-span-2 lg:col-span-1 lg:row-span-2' : ''
            }`}
          >
            <h3 className="titulo text-[1.4rem] text-gold200">{r.titulo}</h3>
            <p className="mt-4 text-[0.95rem] leading-relaxed text-text2">
              {r.texto}
            </p>
          </article>
        ))}
      </div>
    </Secao>
  );
}
