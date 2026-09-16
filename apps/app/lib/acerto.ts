import type { Tournament } from '@/types';
import { entriesOf } from './payouts';

export interface SettlementBalance { id: string; name: string; cents: number; entriesCents: number; paidCents: number; prizeCents: number }
export interface SettlementTransfer { from: string; to: string; cents: number }
export type Settlement = { balances: SettlementBalance[]; transfers: SettlementTransfer[]; error: string | null };
export const ORGANIZER = '__organizer__';
const cents = (value: number) => Math.round(value * 100);
const brl = (value: number) => (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function settlement(t: Tournament): Settlement {
  const invalid = (error: string): Settlement => ({ balances: [], transfers: [], error });
  if (t.status !== 'finished') return invalid('O acerto fica disponível depois de encerrar a noite.');
  if (!t.players.length) return invalid('Não há jogadores para calcular o acerto.');
  if (new Set(t.players.map(p => p.id)).size !== t.players.length || t.players.some(p => p.id === ORGANIZER)) return invalid('Existem identificadores de jogadores inconsistentes.');
  if (!Number.isFinite(t.buyIn) || t.buyIn <= 0) return invalid('Confira o valor do buy-in.');
  if (t.players.some(p => p.paymentStatus === 'disputed')) return invalid('Resolva os pagamentos contestados antes de calcular o acerto.');
  if (t.players.some(p => !p.position || ![p.buyIns, p.reEntries, p.addOns].every(n => Number.isSafeInteger(n) && n >= 0) || !Number.isFinite(p.prize) || p.prize! < 0)) return invalid('Confira as entradas, colocações e prêmios finais de todos os jogadores.');
  if (new Set(t.players.map(p => p.position)).size !== t.players.length) return invalid('Existem colocações finais repetidas.');
  const balances: SettlementBalance[] = t.players.map(p => {
    const entriesCents = cents(entriesOf(p) * t.buyIn);
    const paidCents = p.paymentStatus === 'confirmed' ? entriesCents : 0;
    const prizeCents = cents(p.prize!);
    return { id: p.id, name: p.name, entriesCents, paidCents, prizeCents, cents: prizeCents - entriesCents + paidCents };
  });
  if (balances.some(b => ![b.cents, b.entriesCents, b.paidCents, b.prizeCents].every(Number.isSafeInteger))) return invalid('Valores acima do limite seguro de cálculo.');
  const pool = balances.reduce((s, b) => s + b.entriesCents, 0);
  if (!Number.isSafeInteger(pool) || pool !== balances.reduce((s, b) => s + b.prizeCents, 0)) return invalid('A soma dos prêmios não corresponde ao total das entradas.');
  const held = balances.reduce((s, b) => s + b.paidCents, 0);
  balances.push({ id: ORGANIZER, name: 'Caixa do organizador', cents: -held, entriesCents: 0, paidCents: 0, prizeCents: 0 });
  const debtors = balances.filter(b => b.cents < 0).map(b => ({ id: b.id, amount: -b.cents }));
  const creditors = balances.filter(b => b.cents > 0).map(b => ({ id: b.id, amount: b.cents }));
  const transfers: SettlementTransfer[] = [];
  // Casar os maiores saldos reduz intermediarios, sem prometer minimo global.
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
    creditors.sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
    const from = debtors[0];
    const to = creditors[0];
    const amount = Math.min(from.amount, to.amount);
    transfers.push({ from: from.id, to: to.id, cents: amount });
    from.amount -= amount; to.amount -= amount;
    if (!from.amount) debtors.shift();
    if (!to.amount) creditors.shift();
  }
  if (debtors.length || creditors.length) return invalid('Os saldos não fecham. Confira os registros.');
  return { balances, transfers, error: null };
}

export function settlementSummary(t: Tournament, plan: Settlement) {
  if (plan.error) return plan.error;
  const name = (id: string) => plan.balances.find(b => b.id === id)!.name.replace(/[\r\n]+/g, ' ');
  return [
    `King's Table · Acerto de ${t.name.replace(/[\r\n]+/g, ' ')}`,
    'Sugestão considerando entradas confirmadas no caixa do organizador e nenhum prêmio pago ainda.',
    ...plan.transfers.map((x, i) => `${i + 1}. ${name(x.from)} → ${name(x.to)}: ${brl(x.cents)}`),
    ...(plan.transfers.length ? [] : ['Todos os saldos estão zerados.']),
    'Confira os registros antes de transferir. Esta lista não confirma pagamentos bancários.',
  ].join('\n');
}
