import type { Tournament } from '@/types';
import { distribuirPremios, prizePool } from './payouts';

/* Regras do torneio que não dependem de React nem de armazenamento.
 *
 * Vivem fora do store por um motivo prático: o store importa AsyncStorage, que
 * é módulo nativo e só existe dentro do app. Aqui a regra roda em node e pode
 * ser testada de verdade — e regra de premiação errada é a que estraga a noite.
 */

/** Quem ainda está de pé: sem posição final é porque não caiu. */
export const emJogo = (t: Tournament) => t.players.filter((p) => !p.position);

/**
 * Fecha o torneio quando sobra um. O último de pé é campeão e cada faixa
 * recebe o valor calculado sobre o bolo DAQUELA noite.
 *
 * Os prêmios são gravados no jogador, e não calculados na hora de mostrar,
 * porque a tabela depende do tamanho do campo e do bolo daquele torneio.
 * Recalcular depois, com a liga já tendo outro tamanho, pagaria o campeão de
 * ontem pela mesa de hoje.
 */
export function encerrarSePreciso(t: Tournament): Tournament {
  if (emJogo(t).length > 1) return t;

  const faixas = distribuirPremios(prizePool(t), t.players.length);
  const premioDe = (pos: number) => faixas.find((f) => f.place === pos)?.amount ?? 0;

  return {
    ...t,
    status: 'finished',
    players: t.players.map((p) => {
      const position = p.position ?? 1; // quem sobrou é o campeão
      return { ...p, position, prize: premioDe(position) };
    }),
  };
}

/**
 * Elimina um jogador e devolve o torneio já encerrado, se era o penúltimo.
 *
 * A posição é quantos ainda estavam de pé no momento da queda: caiu com sete
 * na mesa, terminou em sétimo. Contar eliminações em vez de sobreviventes dá a
 * ordem invertida, que é o erro clássico deste cálculo.
 */
export function eliminar(t: Tournament, playerId: string): Tournament {
  const vivos = emJogo(t);
  const posicao = vivos.length;
  if (posicao <= 1) return t; // não se elimina o último de pé
  if (!vivos.some((p) => p.id === playerId)) return t; // já caiu, ou não existe

  const players = t.players.map((p) =>
    p.id === playerId
      ? { ...p, position: posicao, eliminatedAt: new Date().toISOString() }
      : p,
  );
  return encerrarSePreciso({ ...t, players, status: 'running' });
}

/**
 * Desfaz a queda de um jogador (erro de dedo acontece, e acontece na mesa).
 *
 * Se o torneio já tinha acabado, o campeão volta junto para "em jogo": sem
 * isso sobrariam dois jogadores disputando a mesma posição.
 */
export function desfazerEliminacao(t: Tournament, playerId: string): Tournament {
  const alvo = t.players.find((p) => p.id === playerId);
  if (!alvo?.position) return t;

  const limpar = (p: typeof alvo) => ({
    ...p,
    position: undefined,
    prize: undefined,
    eliminatedAt: undefined,
  });

  return {
    ...t,
    status: 'running',
    players: t.players.map((p) =>
      p.id === playerId || (t.status === 'finished' && p.position === 1) ? limpar(p) : p,
    ),
  };
}
