/* O sinal da mesa: quanto dela já foi percorrido, e onde ela está.
 *
 * Existe porque duas coisas distantes precisam do mesmo número. A seção
 * `Mesa` é quem sabe a própria geometria (ela mede o próprio bloco enquanto
 * rola) e é quem mostra o contador no centro do feltro; a cena 3D é quem
 * desenha a mesa, as pilhas e a ficha que pousa nelas — e ela vive no layout
 * raiz, fora da seção.
 *
 * Calcular o progresso duas vezes, uma de cada lado, é o tipo de coisa que
 * casa no dia em que se escreve e desencontra no primeiro ajuste de altura da
 * dobra: o contador diria "3 de pé" com quatro pilhas ainda na mesa. Um
 * número, uma fonte.
 *
 * Mesmo padrão de `abertura.ts`, e pelo mesmo motivo: contexto exigiria um
 * provider em volta do site inteiro por causa de um número.
 */

export type EstadoMesa = {
  /** `false` enquanto a dobra não está montada ou não foi medida. */
  ativa: boolean;
  /** 0 quando a dobra chega, 1 quando ela termina de passar. */
  progresso: number;
  /** Topo do bloco sticky da mesa em pixels da viewport. */
  deslocamentoY: number;
  /** Limites visíveis da própria seção, em pixels da viewport. */
  recorteTopo: number;
  recorteBaixo: number;
};

let estado: EstadoMesa = { ativa: false, progresso: 0, deslocamentoY: 0, recorteTopo: 0, recorteBaixo: 0 };
const inscritos = new Set<(e: EstadoMesa) => void>();

export function definirMesa(novo: EstadoMesa) {
  if (
    estado.ativa === novo.ativa &&
    Math.abs(estado.progresso - novo.progresso) < 0.001 &&
    Math.abs(estado.deslocamentoY - novo.deslocamentoY) < 0.5 &&
    Math.abs(estado.recorteTopo - novo.recorteTopo) < 0.5 &&
    Math.abs(estado.recorteBaixo - novo.recorteBaixo) < 0.5
  ) {
    return;
  }
  estado = novo;
  for (const avisar of inscritos) avisar(estado);
}

export function mesaAgora() {
  return estado;
}

export function assinarMesa(avisar: (e: EstadoMesa) => void) {
  inscritos.add(avisar);
  return () => {
    inscritos.delete(avisar);
  };
}
