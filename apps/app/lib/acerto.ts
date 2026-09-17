import type { Tournament } from '@/types';
import { entriesOf } from './payouts';
import { novaIdentidade } from './identidade';

export interface SettlementBalance { id: string; name: string; cents: number; entriesCents: number; paidCents: number; prizeCents: number }
export interface SettlementTransfer { from: string; to: string; cents: number }
export type Settlement = { balances: SettlementBalance[]; transfers: SettlementTransfer[]; error: string | null };
export const ORGANIZER = '__organizer__';
const cents = (value: number) => Math.round(value * 100);
const brl = (value: number) => (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function settlementFingerprint(t: Tournament) {
  return JSON.stringify([t.status, t.buyIn, [...t.players].sort((a, b) => a.id.localeCompare(b.id)).map(p => [p.id, p.buyIns, p.reEntries, p.addOns, p.paymentStatus, p.position, p.prize])]);
}

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
  const recorded = t.settlementPayments ?? [];
  const baseline = settlementFingerprint(t);
  if (new Set(recorded.map(p => p.id)).size !== recorded.length) return invalid('Existem transferências duplicadas no histórico.');
  for (const payment of recorded.filter(p => !p.voidedAt)) {
    if (payment.baseline !== baseline) return invalid('Entradas ou prêmios mudaram depois de um acerto registrado. Confira o histórico e estorne os registros incompatíveis antes de continuar.');
    const from = balances.find(b => b.id === payment.from);
    const to = balances.find(b => b.id === payment.to);
    if (!from || !to || from === to || !Number.isSafeInteger(payment.cents) || payment.cents <= 0) return invalid('Existe uma transferência inválida no histórico. Confira e estorne o registro.');
    // Pagamento real reduz a divida do remetente e o credito do destinatario.
    from.cents += payment.cents;
    to.cents -= payment.cents;
    if (![from.cents, to.cents].every(Number.isSafeInteger)) return invalid('Valores acima do limite seguro de cálculo.');
  }
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

export function recordSettlement(t: Tournament, from: string, to: string, amount: number): { tournament: Tournament; error: string | null } {
  const plan = settlement(t);
  const fail = (error: string) => ({ tournament: t, error });
  if (plan.error) return fail(plan.error);
  const debtor = plan.balances.find(b => b.id === from);
  const creditor = plan.balances.find(b => b.id === to);
  if (!Number.isSafeInteger(amount) || amount <= 0 || !debtor || !creditor || from === to || debtor.cents >= 0 || creditor.cents <= 0 || amount > Math.min(-debtor.cents, creditor.cents)) return fail('Informe um valor positivo que não ultrapasse o saldo de quem paga e de quem recebe.');
  const payment = { id: novaIdentidade(), from, to, cents: amount, at: new Date().toISOString(), baseline: settlementFingerprint(t) };
  return { tournament: { ...t, settlementPayments: [...(t.settlementPayments ?? []), payment] }, error: null };
}

export function voidSettlement(t: Tournament, paymentId: string): Tournament {
  if (!t.settlementPayments?.some(p => p.id === paymentId && !p.voidedAt)) return t;
  return { ...t, settlementPayments: t.settlementPayments.map(p => p.id === paymentId && !p.voidedAt ? { ...p, voidedAt: new Date().toISOString() } : p) };
}

export function settlementSummary(t: Tournament, plan: Settlement) {
  if (plan.error) return plan.error;
  const name = (id: string) => plan.balances.find(b => b.id === id)!.name.replace(/[\r\n]+/g, ' ');
  return [
    `King's Table · Acerto de ${t.name.replace(/[\r\n]+/g, ' ')}`,
    'Saldo restante após os acertos registrados. Entradas confirmadas consideradas no caixa do organizador.',
    ...((t.settlementPayments ?? []).filter(p => !p.voidedAt).length ? ['ACERTOS REGISTRADOS', ...(t.settlementPayments ?? []).filter(p => !p.voidedAt).map(p => `${name(p.from)} → ${name(p.to)}: ${brl(p.cents)}`)] : []),
    'AINDA FALTA PAGAR',
    ...plan.transfers.map((x, i) => `${i + 1}. ${name(x.from)} → ${name(x.to)}: ${brl(x.cents)}`),
    ...(plan.transfers.length ? [] : ['Todos os saldos estão zerados.']),
    'Confira os registros antes de transferir. Esta lista não confirma pagamentos bancários.',
  ].join('\n');
}
