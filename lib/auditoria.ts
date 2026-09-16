import type { AuditEvent, Tournament, TournamentPlayer } from '@/types';
import { lugarJogador } from './assentos';

const dinheiro = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const PAGAMENTOS = { pending: 'A receber', confirmed: 'Pago', disputed: 'Contestado' };
const STATUS = { upcoming: 'Agendada', running: 'Em andamento', finished: 'Encerrada', cancelled: 'Cancelada' };
const resumoJogador = (p: TournamentPlayer) => `${p.name} · ${lugarJogador(p)} · ${p.buyIns + p.reEntries + p.addOns} entradas · ${PAGAMENTOS[p.paymentStatus]}`;

export function auditar(antes: Tournament | undefined, depois: Tournament, agora = new Date().toISOString()): Tournament {
  if (antes === depois) return depois;
  const changes: AuditEvent['changes'] = [];
  const add = (label: string, before: string, after: string) => { if (before !== after) changes.push({ label, before, after }); };
  if (!antes) add('Mesa criada', 'Não existia', depois.name);
  else {
    add('Nome da mesa', antes.name, depois.name);
    add('Estado da noite', STATUS[antes.status], STATUS[depois.status]);
    add('Buy-in', dinheiro(antes.buyIn), dinheiro(depois.buyIn));
    add('Data e horário', antes.startTime, depois.startTime);
    add('Local', antes.location || 'Não informado', depois.location || 'Não informado');
    add('Vagas', String(antes.capacity ?? 'Sem limite'), String(depois.capacity ?? 'Sem limite'));
    add('Assentos por mesa', String(antes.seatsPerTable ?? 10), String(depois.seatsPerTable ?? 10));
    for (const p of depois.players) {
      const old = antes.players.find(o => o.id === p.id);
      if (!old) { add(`Entrada de ${p.name}`, 'Sem entrada', resumoJogador(p)); continue; }
      add(`Nome de ${old.name}`, old.name, p.name);
      add(`Assento de ${p.name}`, lugarJogador(old), lugarJogador(p));
      add(`Pagamento de ${p.name}`, PAGAMENTOS[old.paymentStatus], PAGAMENTOS[p.paymentStatus]);
      for (const [key, label] of [['buyIns', 'Buy-ins'], ['reEntries', 'Reentradas'], ['addOns', 'Add-ons']] as const) add(`${label} de ${p.name}`, String(old[key]), String(p[key]));
      add(`Colocação de ${p.name}`, old.position ? `${old.position}º` : 'Em jogo', p.position ? `${p.position}º` : 'Em jogo');
      add(`Prêmio de ${p.name}`, dinheiro(old.prize ?? 0), dinheiro(p.prize ?? 0));
    }
    for (const p of antes.players) if (!depois.players.some(n => n.id === p.id)) add(`Entrada de ${p.name}`, resumoJogador(p), 'Removida');
    const presenca = { confirmed: 'Confirmado', maybe: 'Talvez', absent: 'Não vai', waiting: 'Espera' };
    for (const c of depois.invitees ?? []) {
      const old = antes.invitees?.find(o => o.id === c.id);
      add(`Presença de ${c.name}`, old ? presenca[old.status] : 'Sem convite', presenca[c.status]);
    }
    for (const c of antes.invitees ?? []) if (!depois.invitees?.some(n => n.id === c.id)) add(`Convite de ${c.name}`, presenca[c.status], 'Removido');
  }
  if (!changes.length) return depois;
  const summary = antes?.seatUndo && !depois.seatUndo && changes.some(c => c.label.startsWith('Assento')) ? 'Assentos restaurados' : changes[0].label;
  const event: AuditEvent = { id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, at: agora, actor: 'Organizador deste aparelho', summary, changes };
  return { ...depois, audit: [...(antes?.audit ?? []), event] };
}
