import type { Tournament, TournamentPlayer } from '@/types';
import { distribuirPremios, prizePool } from './payouts';

/* Regras do torneio que não dependem de React nem de armazenamento.
 *
 * Vivem fora do store por um motivo prático: o store importa AsyncStorage, que
 * é módulo nativo e só existe dentro do app. Aqui a regra roda em node e pode
 * ser testada de verdade — e regra de premiação errada é a que estraga a noite.
 */

/** Quem ainda está de pé: sem posição final é porque não caiu. */
export const emJogo = (t: Tournament) => t.players.filter((p) => !p.position);

export function corrigirNomeJogador(t: Tournament, playerId: string, name: string): {
  tournament: Tournament; error: string | null;
} {
  if (t.status === 'cancelled') return { tournament: t, error: 'Uma noite cancelada não pode ser alterada.' };
  const player = t.players.find(p => p.id === playerId);
  if (!player) return { tournament: t, error: 'Jogador não encontrado nesta mesa.' };
  const normalized = name.trim();
  if (!normalized || normalized.length > 60) {
    return { tournament: t, error: 'Use um nome de 1 a 60 caracteres.' };
  }
  if (player.name === normalized) return { tournament: t, error: 'O nome já está assim.' };
  if (t.players.some(p => p.id !== playerId && p.name.trim().toLocaleLowerCase('pt-BR') === normalized.toLocaleLowerCase('pt-BR'))) {
    return { tournament: t, error: 'Já existe um jogador com esse nome nesta mesa.' };
  }
  return { tournament: {
    ...t,
    players: t.players.map(p => p.id === playerId ? { ...p, name: normalized } : p),
    invitees: t.invitees?.map(invite => invite.playerId === playerId ? { ...invite, name: normalized } : invite),
  }, error: null };
}

function temAtividadeFinanceiraAuditada(t: Tournament, nomeAtual: string): boolean {
  const renomes = new Map<string, Set<string>>();
  for (const event of t.audit ?? []) {
    for (const change of event.changes) {
      if (!change.label.startsWith('Nome de ')) continue;
      if (!renomes.has(change.before)) renomes.set(change.before, new Set());
      if (!renomes.has(change.after)) renomes.set(change.after, new Set());
      renomes.get(change.before)!.add(change.after);
      renomes.get(change.after)!.add(change.before);
    }
  }
  const nomes = new Set([nomeAtual]);
  const fila = [nomeAtual];
  for (const nome of fila) {
    for (const alias of renomes.get(nome) ?? []) {
      if (nomes.has(alias)) continue;
      nomes.add(alias);
      fila.push(alias);
    }
  }
  const rotulos = new Set([...nomes].flatMap(nome =>
    ['Pagamento', 'Buy-ins', 'Reentradas', 'Add-ons'].map(campo => `${campo} de ${nome}`)));
  return (t.audit ?? []).some(event => event.changes.some(change =>
    rotulos.has(change.label)));
}

export function temHistoricoFinanceiro(t: Tournament, p: TournamentPlayer): boolean {
  return p.financialActivityRecorded || (p.financialActivityRecorded === undefined && temAtividadeFinanceiraAuditada(t, p.name));
}

export function motivoBloqueioRemocao(t: Tournament, p: TournamentPlayer): string | null {
  if (t.status !== 'upcoming') return 'Depois que a noite começa, a entrada precisa permanecer no histórico.';
  if (p.position || p.eliminatedAt || p.prize !== undefined) return 'Este jogador já tem um resultado registrado.';
  if (p.buyIns !== 1 || p.reEntries !== 0 || p.addOns !== 0) return 'Remova reentradas e add-ons antes de retirar a entrada.';
  if (p.paymentStatus !== 'pending') return 'Confira o pagamento e qualquer devolução antes de retirar esta entrada.';
  if (temHistoricoFinanceiro(t, p)) {
    return 'Esta entrada já teve pagamento ou movimentação financeira. Preserve-a no histórico.';
  }
  if (t.settlementPayments?.some(payment => payment.from === p.id || payment.to === p.id)) {
    return 'Há um acerto ligado a este jogador. A entrada deve permanecer no histórico.';
  }
  return null;
}

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
export function podeDesfazerEliminacao(t: Tournament, playerId: string): boolean {
  const alvo = t.players.find(p => p.id === playerId);
  const ultima = Math.min(...t.players.filter(p => (p.position ?? 0) > 1).map(p => p.position!));
  return (t.status === 'running' || t.status === 'finished') && !!alvo?.position && alvo.position === ultima;
}

export function desfazerEliminacao(t: Tournament, playerId: string): Tournament {
  const alvo = t.players.find((p) => p.id === playerId);
  if (!alvo || !podeDesfazerEliminacao(t, playerId)) return t;

  const limpar = (p: typeof alvo) => ({
    ...p,
    position: undefined,
    prize: undefined,
    eliminatedAt: undefined,
    ...((p.tableNumber && p.seatNumber && t.players.some(q => q.id !== p.id && (!q.position || (t.status === 'finished' && q.position === 1)) && q.tableNumber === p.tableNumber && q.seatNumber === p.seatNumber)) ? { tableNumber: undefined, seatNumber: undefined } : {}),
  });

  return {
    ...t,
    status: 'running',
    players: t.players.map((p) =>
      p.id === playerId || (t.status === 'finished' && p.position === 1) ? limpar(p) : p,
    ),
  };
}
