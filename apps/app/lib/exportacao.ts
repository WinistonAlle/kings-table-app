import type { Tournament } from '@/types';
import { entriesOf, prizePool } from './payouts';

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const status = { upcoming: 'Agendada', running: 'Em andamento', finished: 'Encerrada', cancelled: 'Cancelada' };
const payment = { pending: 'A receber', confirmed: 'Pago', disputed: 'Contestado' };
const line = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();
const cents = (value: number) => Math.round(value * 100);

export function nightTotals(t: Tournament) {
  const paid = t.players.filter(p => p.paymentStatus === 'confirmed').reduce((sum, p) => sum + cents(entriesOf(p) * t.buyIn), 0) / 100;
  const disputed = t.players.filter(p => p.paymentStatus === 'disputed').reduce((sum, p) => sum + cents(entriesOf(p) * t.buyIn), 0) / 100;
  const pending = t.players.filter(p => p.paymentStatus === 'pending').reduce((sum, p) => sum + cents(entriesOf(p) * t.buyIn), 0) / 100;
  return { paid, disputed, pending };
}

export function nightSummary(t: Tournament) {
  const totals = nightTotals(t);
  const result = [...t.players].filter(p => p.position).sort((a, b) => a.position! - b.position!);
  return [
    `King's Table · ${line(t.name)}`,
    `Status: ${status[t.status]}`,
    ...(t.location ? [`Local: ${line(t.location)}`] : []),
    `Jogadores: ${t.players.length} · Entradas: ${t.players.reduce((s, p) => s + entriesOf(p), 0)}`,
    `Buy-in: ${money(t.buyIn)} · Bolo das entradas: ${money(prizePool(t))}`,
    '',
    t.status === 'finished' ? 'RESULTADO FINAL' : 'CLASSIFICAÇÃO PARCIAL',
    ...(result.length ? result.map(p => `${p.position}º · ${line(p.name)}${t.status === 'finished' ? ` · Prêmio: ${money(p.prize ?? 0)}` : ''}`) : ['Sem colocações registradas.']),
    ...(t.status === 'running' ? [`Ainda em jogo: ${t.players.filter(p => !p.position).map(p => line(p.name)).join(', ') || 'nenhum'}`] : []),
    '',
    'ENTRADAS E PAGAMENTOS',
    ...t.players.map(p => `${line(p.name)} · ${entriesOf(p)} entrada(s) · ${money(entriesOf(p) * t.buyIn)} · ${payment[p.paymentStatus]}`),
    `Marcado como pago: ${money(totals.paid)}`,
    `A receber: ${money(totals.pending)} · Contestado: ${money(totals.disputed)}`,
    'Pagamentos registrados pelo organizador. Não é confirmação bancária nem registro de pagamento de prêmios.',
  ].join('\n');
}

// Neutraliza formulas e escapa separadores, aspas e quebras de linha.
export function csvCell(value: unknown) {
  const text = value === undefined || value === null ? '' : typeof value === 'number' ? String(value).replace('.', ',') : String(value);
  const safe = typeof value === 'string' && /^[\s\uFEFF]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function csv(rows: unknown[][]) {
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}
export type ExportKind = 'players' | 'blinds' | 'audit';
export function tournamentCsv(t: Tournament, kind: ExportKind) {
  if (kind === 'players') return csv([
    ['Mesa ID', 'Mesa', 'Status', 'Jogador ID', 'Jogador', 'Mesa de jogo', 'Assento', 'Buy-in', 'Entradas iniciais', 'Reentradas', 'Add-ons', 'Total devido', 'Pagamento', 'Posição', 'Prêmio final'],
    ...t.players.map(p => [t.id, t.name, status[t.status], p.id, p.name, p.tableNumber, p.seatNumber, t.buyIn, p.buyIns, p.reEntries, p.addOns, cents(entriesOf(p) * t.buyIn) / 100, payment[p.paymentStatus], p.position, t.status === 'finished' ? p.prize ?? 0 : undefined]),
  ]);
  if (kind === 'blinds') return csv([
    ['Mesa ID', 'Mesa', 'Ordem', 'Tipo', 'Nível', 'Small blind', 'Big blind', 'Ante', 'Duração (minutos)'],
    ...t.blindStructure.map((b, i) => [t.id, t.name, i + 1, b.isBreak ? 'Intervalo' : 'Nível', b.level, b.smallBlind, b.bigBlind, b.ante, b.durationMinutes]),
  ]);
  return csv([
    ['Mesa ID', 'Mesa', 'Evento ID', 'Data ISO', 'Autor', 'Ação', 'Campo', 'Antes', 'Depois'],
    ...(t.audit ?? []).flatMap(e => (e.changes.length ? e.changes : [{ label: '', before: '', after: '' }]).map(change => [t.id, t.name, e.id, e.at, e.actor, e.summary, change.label, change.before, change.after])),
  ]);
}

export function exportFilename(t: Tournament, kind: ExportKind) {
  const slug = t.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'mesa';
  return `kings-table-${slug}-${kind}.csv`;
}
