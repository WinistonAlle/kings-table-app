import type { Tournament } from '@/types';

export type FiltroMesa = 'todas' | 'abertas' | 'encerradas';

export function listarMesas(torneios: Tournament[], filtro: FiltroMesa, busca = '') {
  const termo = busca.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  return torneios.filter(t => {
    const status = filtro === 'todas' || (filtro === 'abertas'
      ? t.status === 'running' || t.status === 'upcoming'
      : t.status === 'finished');
    const nome = t.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
    return status && nome.includes(termo);
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
