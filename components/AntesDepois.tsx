'use client';

import { useState } from 'react';
import { BotaoOuro, Rotulo, Secao, Titulo, Realce } from './Secao';
import OptionWheel from './OptionWheel';
import { FEATURE_NAMES } from './features';

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

/* Exportado: os três passos foram para o MEIO DA MESA (`Mesa.tsx`), que é
   onde eles acontecem. Descrever o laço da noite ao lado de um desenho dele é
   redundante; descrever em cima do desenho é legenda. */
export const PASSOS = [
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
  const [selecionado, setSelecionado] = useState(2);
  return (
    <Secao id="como-funciona" className="py-24 lg:py-32">
      <div className="max-w-2xl">
        <Rotulo>O sistema</Rotulo>
        <Titulo>
          Tudo para <Realce>organizar sua mesa</Realce>.
        </Titulo>
      </div>

      <div className="mt-10">
        <OptionWheel items={FEATURE_NAMES} onChange={setSelecionado} />
      </div>
      <div onClick={() => window.dispatchEvent(new CustomEvent('feature-selecionada', { detail: selecionado }))}>
        <BotaoOuro href="#recursos">Explorar funcionalidades</BotaoOuro>
      </div>

    </Secao>
  );
}
