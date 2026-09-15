import type { BlindLevel } from '@/types';

export function validarEstrutura(niveis: BlindLevel[]) {
  if (!niveis.length || !niveis.some(n => !n.isBreak)) return 'Adicione pelo menos um nível de blinds.';
  for (let i = 0; i < niveis.length; i++) {
    const n = niveis[i];
    if (!Number.isSafeInteger(n.durationMinutes) || n.durationMinutes < 1 || n.durationMinutes > 240) return `Informe uma duração entre 1 e 240 minutos na linha ${i + 1}.`;
    if (!n.isBreak && (![n.smallBlind, n.bigBlind, n.ante].every(v => Number.isSafeInteger(v) && v >= 0) || n.bigBlind <= 0 || n.smallBlind > n.bigBlind)) return `Confira os blinds e o ante na linha ${i + 1}. O big blind deve ser positivo e não menor que o small blind.`;
  }
  return null;
}

export function normalizarEstrutura(niveis: BlindLevel[]): BlindLevel[] {
  let nivel = 0;
  return niveis.map(n => ({ ...n, level: n.isBreak ? nivel : ++nivel, ...(n.isBreak ? { smallBlind: 0, bigBlind: 0, ante: 0 } : {}) }));
}

export function valorBuyIn(texto: string) {
  if (!/^\d+(?:[,.]\d{1,2})?$/.test(texto.trim())) return 0;
  const valor = Number(texto.trim().replace(',', '.'));
  return Number.isFinite(valor) && valor > 0 && valor <= 1000000 ? Math.round(valor * 100) / 100 : 0;
}
