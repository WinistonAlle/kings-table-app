import type { Attendance, NightInvitee, Tournament } from '@/types';

export function dataAgendada(data: string, hora: string, agora = new Date()): string | null {
  const d = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data.trim());
  const h = /^(\d{2}):(\d{2})$/.exec(hora.trim());
  if (!d || !h) return null;
  const [dia, mes, ano, horas, minutos] = [+d[1], +d[2], +d[3], +h[1], +h[2]];
  const valor = new Date(ano, mes - 1, dia, horas, minutos);
  if (valor.getFullYear() !== ano || valor.getMonth() !== mes - 1 || valor.getDate() !== dia || horas > 23 || minutos > 59 || valor <= agora) return null;
  return valor.toISOString();
}

export function statusPresenca(t: Tournament, status: Attendance, id?: string): Attendance {
  if (status !== 'confirmed' || !t.capacity) return status;
  const presentes = new Set(t.players.map(p => p.name.trim().toLocaleLowerCase('pt-BR')));
  for (const convidado of t.invitees ?? []) {
    if (convidado.id !== id && convidado.status === 'confirmed') presentes.add(convidado.name.trim().toLocaleLowerCase('pt-BR'));
  }
  const atual = t.invitees?.find(c => c.id === id);
  if (atual && presentes.has(atual.name.trim().toLocaleLowerCase('pt-BR'))) return status;
  return presentes.size >= t.capacity ? 'waiting' : status;
}

export function adicionarConvidado(t: Tournament, convidado: NightInvitee): Tournament {
  const nome = convidado.name.trim();
  if (!nome || (t.invitees ?? []).some(c => c.name.trim().toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR'))) return t;
  return { ...t, invitees: [...(t.invitees ?? []), { ...convidado, name: nome, status: statusPresenca(t, convidado.status) }] };
}

export function vagaParaJogador(t: Tournament, name: string): boolean {
  if (!t.capacity) return true;
  if (t.players.filter(p => !p.position).length >= t.capacity) return false;
  if (t.status !== 'upcoming') return true;
  const reservados = new Set([...t.players.map(p => p.name.trim().toLocaleLowerCase('pt-BR')), ...(t.invitees ?? []).filter(c => c.status === 'confirmed').map(c => c.name.trim().toLocaleLowerCase('pt-BR'))]);
  return reservados.has(name.trim().toLocaleLowerCase('pt-BR')) || reservados.size < t.capacity;
}

export function textoConvite(t: Tournament): string {
  const data = new Date(t.startTime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return [`Poker: ${t.name}`, `Quando: ${data}`, t.location ? `Local: ${t.location}` : '', `Buy-in: ${t.buyIn.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, t.capacity ? `Vagas: ${t.capacity}` : '', 'Responda com: confirmado, talvez ou não vou.'].filter(Boolean).join('\n');
}
