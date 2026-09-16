import type { Tournament, TournamentPlayer } from '@/types';

const aberta = (t: Tournament) => t.status === 'upcoming' || t.status === 'running';
const ativos = (t: Tournament) => t.players.filter(p => !p.position);
export const lugarJogador = (p: Pick<TournamentPlayer, 'tableNumber' | 'seatNumber'>) => p.tableNumber && p.seatNumber ? `Mesa ${p.tableNumber} · assento ${p.seatNumber}` : 'Sem assento';

function guardar(t: Tournament): NonNullable<Tournament['seatUndo']> {
  return { seatsPerTable: t.seatsPerTable ?? 10, players: ativos(t).map(p => ({ id: p.id, tableNumber: p.tableNumber, seatNumber: p.seatNumber })) };
}

export function sortearAssentos(t: Tournament, tamanho = t.seatsPerTable ?? 10, random = Math.random): Tournament {
  if (!aberta(t) || !Number.isInteger(tamanho) || tamanho < 2 || tamanho > 12 || ativos(t).length < 2) return t;
  const ids = ativos(t).map(p => p.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const lugares = new Map(ids.map((id, i) => [id, { tableNumber: Math.floor(i / tamanho) + 1, seatNumber: i % tamanho + 1 }]));
  return { ...t, seatsPerTable: tamanho, seatUndo: guardar(t), players: t.players.map(p => lugares.has(p.id) ? { ...p, ...lugares.get(p.id) } : p) };
}

export function moverAssento(t: Tournament, id: string, mesa: number, assento: number): Tournament {
  const vivos = ativos(t);
  const tamanho = t.seatsPerTable ?? 10;
  const limiteMesas = Math.max(1, Math.ceil(vivos.length / tamanho), ...vivos.map(p => p.tableNumber ?? 0));
  const alvo = vivos.find(p => p.id === id);
  if (!aberta(t) || !alvo || !Number.isInteger(mesa) || !Number.isInteger(assento) || mesa < 1 || mesa > limiteMesas || assento < 1 || assento > tamanho) return t;
  if (alvo.tableNumber === mesa && alvo.seatNumber === assento) return t;
  const ocupado = vivos.find(p => p.tableNumber === mesa && p.seatNumber === assento);
  return { ...t, seatUndo: guardar(t), players: t.players.map(p => {
    if (p.id === alvo.id) return { ...p, tableNumber: mesa, seatNumber: assento };
    if (p.id === ocupado?.id) return { ...p, tableNumber: alvo.tableNumber, seatNumber: alvo.seatNumber };
    return p;
  }) };
}

export function podeDesfazerAssentos(t: Tournament): boolean {
  return aberta(t) && !!t.seatUndo && ativos(t).length === t.seatUndo.players.length && ativos(t).every(p => t.seatUndo!.players.some(s => s.id === p.id));
}

export function desfazerAssentos(t: Tournament): Tournament {
  if (!podeDesfazerAssentos(t)) return t;
  const anteriores = new Map(t.seatUndo!.players.map(p => [p.id, p]));
  return { ...t, seatsPerTable: t.seatUndo!.seatsPerTable, seatUndo: undefined, players: t.players.map(p => anteriores.has(p.id) ? { ...p, ...anteriores.get(p.id) } : p) };
}
