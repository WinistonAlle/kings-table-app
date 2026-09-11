import type { BlindLevel } from '@/types';

/* Relógio de blinds ancorado no relógio de parede.
 *
 * Antes o timer era um contador: `secondsRemaining -= 1` a cada tique de um
 * `setInterval`. Isso tem dois defeitos, e os dois aparecem justamente na noite
 * de jogo, com o celular no meio da mesa:
 *
 * 1. iOS estrangula timer de JS em segundo plano. Bloqueou a tela, o relógio
 *    atrasa. A correção que existia era repetir `tick()` num laço, um segundo
 *    por vez: meia hora fora do app viravam 1.800 atualizações de estado em
 *    sequência, cada uma notificando a tela.
 * 2. Nada disso sobrevive ao app ser fechado, porque não havia como saber
 *    QUANDO o nível começou — só quanto faltava no último quadro desenhado.
 *
 * A âncora resolve os dois de uma vez. Guarda-se o instante em que o nível
 * acaba (`levelEndsAt`, epoch em ms) e o tempo restante é sempre DERIVADO do
 * relógio. Voltar do segundo plano, ou reabrir o app no dia seguinte, é a mesma
 * conta, feita uma vez só.
 */

export type EstadoRelogio = {
  currentLevel: number;
  /** Instante em que o nível atual acaba. `null` quando pausado. */
  levelEndsAt: number | null;
  /** Quanto falta, em segundos. É a verdade quando pausado. */
  secondsRemaining: number;
  isRunning: boolean;
};

function duracao(structure: BlindLevel[], nivel: number) {
  return (structure[nivel]?.durationMinutes ?? 0) * 60;
}

/**
 * Recalcula o estado a partir do relógio.
 *
 * Avança quantos níveis forem necessários, e não só um: quem deixou o app
 * fechado por quarenta minutos num nível de quinze pulou dois níveis e meio, e
 * ver o relógio "recuperando" nível por nível na frente da mesa seria pior do
 * que não ter guardado nada.
 *
 * Quando a estrutura acaba, o relógio para no fim do último nível em vez de
 * seguir contando negativo: o torneio acabou, não entrou em tempo extra.
 */
export function sincronizar(
  structure: BlindLevel[],
  estado: EstadoRelogio,
  agora: number = Date.now(),
): EstadoRelogio {
  if (!estado.isRunning || estado.levelEndsAt === null) return estado;

  let nivel = estado.currentLevel;
  let fim = estado.levelEndsAt;

  while (agora >= fim) {
    const proximo = nivel + 1;
    if (proximo >= structure.length) {
      return { currentLevel: nivel, levelEndsAt: null, secondsRemaining: 0, isRunning: false };
    }
    nivel = proximo;
    fim += duracao(structure, nivel) * 1000;
  }

  return {
    currentLevel: nivel,
    levelEndsAt: fim,
    /* `ceil` e não `floor`: com floor o relógio mostra 00:00 durante o último
       segundo inteiro do nível, e quem está na mesa lê isso como "acabou"
       um segundo antes de acabar. */
    secondsRemaining: Math.max(0, Math.ceil((fim - agora) / 1000)),
    isRunning: true,
  };
}

/** Começa a correr a partir do que falta agora. */
export function iniciar(estado: EstadoRelogio, agora: number = Date.now()): EstadoRelogio {
  return { ...estado, isRunning: true, levelEndsAt: agora + estado.secondsRemaining * 1000 };
}

/** Congela: o que falta vira número, a âncora some. */
export function pausar(
  structure: BlindLevel[],
  estado: EstadoRelogio,
  agora: number = Date.now(),
): EstadoRelogio {
  const atual = sincronizar(structure, estado, agora);
  return { ...atual, isRunning: false, levelEndsAt: null };
}

/**
 * Salta para um nível, mantendo o estado de corrida.
 *
 * Pular de nível reinicia o tempo desse nível, corrido ou pausado — é o que
 * qualquer um espera do botão "próximo nível" no meio de uma mão que demorou.
 */
export function irParaNivel(
  structure: BlindLevel[],
  estado: EstadoRelogio,
  nivel: number,
  agora: number = Date.now(),
): EstadoRelogio {
  const alvo = Math.min(Math.max(0, nivel), Math.max(0, structure.length - 1));
  const segundos = duracao(structure, alvo);
  return {
    currentLevel: alvo,
    secondsRemaining: segundos,
    isRunning: estado.isRunning,
    levelEndsAt: estado.isRunning ? agora + segundos * 1000 : null,
  };
}
