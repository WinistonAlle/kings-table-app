/* A face da ficha, desenhada em canvas e usada como textura.
 *
 * Canvas e não imagem: a face precisa acompanhar a marca. Se um dia o logo
 * mudar, muda aqui e a ficha 3D acompanha — sem alguém lembrar de reexportar
 * um PNG. E o desenho sai na resolução que o aparelho merece, em vez de esticar
 * um bitmap.
 *
 * O desenho copia a ficha do vídeo: corpo escuro, anel interno, o leão ao
 * centro, o logotipo embaixo e os naipes em volta da borda. Ele não precisa ser
 * idêntico ao último quadro — precisa ser irreconhecível como diferente, que é
 * outra coisa, e mais fácil.
 */

const CAMINHO_MARCA = 'M495.9 0L401.3 111.4L303.3 35.8L296.3 38.7L299.4 34.6L293.6 30.3L318.5 208.9L680.6 208.9L705.1 30.6L597.7 111.4L509 9.2ZM0 271.8L0 1262.3L3.1 1266.4L996 1266.4L1000 1262.3L1000 274.9L996 271.8ZM949.8 322.2L949.8 1212.8L49.7 1212.8L49.7 327.5L47.8 325.4L51.9 322.2ZM152.1 385.9L152.1 390.7L240.6 472.1L244.9 480.1L364.7 590.9L359.8 592.4L333.8 578.4L138.9 508.4L103 492L103 614.4L224.2 707L271.8 749L102.8 713L102.8 851L423.1 1154.5L622.4 1154.5L624.9 1157.6L628.7 1149.3L386.7 927.6L372.7 904.8L367.2 877.6L384.9 902.8L400.7 908.4L483.8 905.6L519.2 911.2L665.8 1034.2L684.6 1048.2L690.5 1048.2L754.6 990.9L754.6 901.2L750.6 897.2L651.3 894.8L701.9 880.4L751.1 858L772.3 844.1L792.7 820.4L803.6 792.9L803.6 775.6L749.1 719.6L749.5 715.6L830.1 715.6L866.4 711L691.8 563L683.6 514.8L663.2 491.7L511 385.9ZM615.4 546.3L637.1 548L637.1 626L608.9 606.4L551 578.4L511.6 546.3ZM103.5 1063.1L102.7 1153.4L107 1157.6L109.4 1154.5L295.1 1154.5L297.5 1157.6L301.7 1154.1L103.5 972.8Z';
const MARCA_W = 1000;
const MARCA_H = 1266;

const OURO = '#c49c5c';
const OURO_CLARO = '#e7d0ac';
const CORPO = '#565049';
const CORPO_ESCURO = '#2a2724';

const NAIPES: Record<string, string> = {
  espada: 'M12 2C12 2 5 8.5 5 13a4.2 4.2 0 0 0 6.2 3.7c-.2 1.9-.8 3.4-2.2 4.3h6c-1.4-.9-2-2.4-2.2-4.3A4.2 4.2 0 0 0 19 13c0-4.5-7-11-7-11z',
  copas: 'M12 21s-7.5-4.9-7.5-10.2A4.3 4.3 0 0 1 12 8.1a4.3 4.3 0 0 1 7.5 2.7C19.5 16.1 12 21 12 21z',
  ouros: 'M12 2l7 10-7 10-7-10 7-10z',
  paus: 'M12 2.5a3.4 3.4 0 0 0-2.6 5.6A3.4 3.4 0 1 0 8.6 14a3.3 3.3 0 0 0 2.6-1.2c-.1 3.2-.7 6-2.2 7.2h6c-1.5-1.2-2.1-4-2.2-7.2a3.3 3.3 0 0 0 2.6 1.2 3.4 3.4 0 1 0-.8-5.9A3.4 3.4 0 0 0 12 2.5z',
};
const ORDEM = ['espada', 'copas', 'ouros', 'paus'] as const;

/** Desenha a face e devolve o canvas, pronto pra virar textura. */
export function desenharFace(lado = 1024): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = lado;
  const c = cv.getContext('2d')!;
  const R = lado / 2;

  /* O corpo. Um degradê muito sutil do topo pra base: no vídeo a face tem um
     gradiente diagonal (58 no canto superior esquerdo caindo a 36 no inferior
     direito), e é ele que faz a peça parecer ter volume. */
  c.fillStyle = CORPO;
  c.beginPath();
  c.arc(R, R, R, 0, Math.PI * 2);
  c.fill();

  /* Encaixes da borda: oito blocos mais escuros, como na ficha real. */
  c.fillStyle = '#2e2926';
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2 - 0.16;
    const a1 = a0 + 0.32;
    c.beginPath();
    c.arc(R, R, R * 0.995, a0, a1);
    c.arc(R, R, R * 0.80, a1, a0, true);
    c.closePath();
    c.fill();
  }

  /* Naipes na borda, entre os encaixes. */
  for (let i = 0; i < 8; i++) {
    const ang = ((i + 0.5) / 8) * Math.PI * 2 - Math.PI / 2;
    const raio = R * 0.885;
    const tam = R * 0.075;
    c.save();
    c.translate(R + Math.cos(ang) * raio, R + Math.sin(ang) * raio);
    c.rotate(ang + Math.PI / 2);
    c.translate(-tam / 2, -tam / 2);
    c.scale(tam / 24, tam / 24);
    c.fillStyle = OURO;
    c.fill(new Path2D(NAIPES[ORDEM[i % 4]]));
    c.restore();
  }

  /* Anel interno: a linha fina que separa a borda do miolo. */
  c.strokeStyle = 'rgba(196,156,92,0.30)';
  c.lineWidth = lado * 0.004;
  c.beginPath();
  c.arc(R, R, R * 0.775, 0, Math.PI * 2);
  c.stroke();

  /* A marca. Escala pela largura, posicionada acima do centro pra abrir espaço
     ao logotipo embaixo — a mesma composição da ficha do vídeo. */
  const larguraMarca = R * 0.62;
  const alturaMarca = (larguraMarca * MARCA_H) / MARCA_W;
  c.save();
  c.translate(R - larguraMarca / 2, R - alturaMarca * 0.72);
  c.scale(larguraMarca / MARCA_W, larguraMarca / MARCA_W);
  c.fillStyle = OURO_CLARO;
  c.fill(new Path2D(CAMINHO_MARCA), 'evenodd');
  c.restore();

  /* O logotipo. */
  c.fillStyle = OURO_CLARO;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `600 ${R * 0.20}px Cormorant Garamond, Georgia, serif`;
  c.fillText("KING'S", R, R + alturaMarca * 0.42);
  c.font = `600 ${R * 0.12}px Cormorant Garamond, Georgia, serif`;
  /* Entreletra na mão: o canvas 2D não tem letter-spacing em todo navegador. */
  const palavra = 'TABLE';
  const esp = R * 0.055;
  const larguraTotal = palavra.split('').reduce((s, ch) => s + c.measureText(ch).width + esp, -esp);
  let x = R - larguraTotal / 2;
  for (const ch of palavra) {
    const w = c.measureText(ch).width;
    c.fillText(ch, x + w / 2, R + alturaMarca * 0.78);
    x += w + esp;
  }

  /* A queda de luz precisa estar aqui, e não na iluminação da cena.
     Uma face plana sob luz direcional recebe a MESMA intensidade em todo
     ponto: a normal não muda, o produto escalar não muda, e o disco sai
     chapado. O volume que se vê no vídeo vem de uma queda diagonal, e os
     números abaixo são medidos no último quadro, não estimados. Ao longo da
     diagonal do canto superior esquerdo para o inferior direito:

       t=0,27 -> 101    t=0,50 -> 101    t=0,61 -> 63    t=0,74 -> 12

     Ou seja: metade da face fica cheia e a queda toda acontece no fim. Um
     gradiente radial não faz isso (escurece o centro junto), por isso é linear
     na diagonal, com as paradas tiradas direto dessas leituras.

     Vem por último de propósito: no vídeo o ouro do logotipo escurece junto
     com o corpo. Sombra que não alcança o que está impresso denuncia que é
     desenho, não peça. */
  const queda = c.createLinearGradient(0, 0, lado, lado);
  queda.addColorStop(0.00, 'rgba(0,0,0,0)');
  queda.addColorStop(0.50, 'rgba(0,0,0,0)');
  queda.addColorStop(0.61, 'rgba(0,0,0,0.38)');
  queda.addColorStop(0.74, 'rgba(0,0,0,0.88)');
  queda.addColorStop(1.00, 'rgba(0,0,0,0.96)');
  c.save();
  c.beginPath();
  c.arc(R, R, R, 0, Math.PI * 2);
  c.clip();
  c.fillStyle = queda;
  c.fillRect(0, 0, lado, lado);
  c.restore();

  return cv;
}

/** A lateral: encaixes verticais alternados, como a borda de uma ficha real. */
export function desenharLateral(larg = 1024, alt = 64): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = larg;
  cv.height = alt;
  const c = cv.getContext('2d')!;
  c.fillStyle = CORPO_ESCURO;
  c.fillRect(0, 0, larg, alt);
  c.fillStyle = '#2a2522';
  const blocos = 24;
  for (let i = 0; i < blocos; i++) {
    if (i % 2) continue;
    c.fillRect((i / blocos) * larg, 0, larg / blocos, alt);
  }
  return cv;
}
