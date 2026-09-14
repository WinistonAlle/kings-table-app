/* A lateral da ficha, desenhada em canvas.
 *
 * A FACE não mora mais aqui. Ela é um recorte do último quadro do vídeo
 * (`public/ficha-face.jpg`), porque o pedido era cor idêntica e cor idêntica
 * não se persegue no olho: a face do vídeo tem iluminação, textura de couro e
 * compressão assadas no pixel, e qualquer redesenho chega perto e erra.
 *
 * O recorte foi tirado do quadro 1920x1080, com o disco medido em centro
 * (950, 540) e raio 351. Os cantos do arquivo foram achatados de propósito: a
 * UV da tampa do cilindro é um círculo inscrito, então o que está fora do
 * disco nunca é amostrado e só atrapalharia o compressor.
 *
 * Sobra a lateral, que no vídeo não aparece (a ficha está de frente) e por
 * isso precisa ser construída. As cores abaixo saíram do anel externo da
 * própria face, para a borda não denunciar que veio de outro lugar. */

/* Medidas no anel r=0,93 da face do vídeo: os encaixes escuros ficam em torno
   de (14,12,9) e o corpo da borda em (49,45,44). */
const BORDA_ESCURA = '#0e0c09';
const BORDA_CORPO = '#312d2c';

/** A lateral: encaixes verticais alternados, como a borda de uma ficha real. */
export function desenharLateral(larg = 1024, alt = 128): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = larg;
  cv.height = alt;
  const c = cv.getContext('2d')!;

  c.fillStyle = BORDA_CORPO;
  c.fillRect(0, 0, larg, alt);

  /* Oito encaixes, os mesmos oito da face: uma ficha cuja borda não conversa
     com o desenho da frente parece duas peças coladas. */
  c.fillStyle = BORDA_ESCURA;
  const blocos = 16;
  for (let i = 0; i < blocos; i += 2) {
    c.fillRect((i / blocos) * larg, 0, larg / blocos, alt);
  }

  /* As duas quinas escurecem. A lateral de uma ficha é levemente abaulada, e
     numa pilha é esse par de linhas escuras que separa uma peça da seguinte.
     Sem elas a pilha vira um cilindro listrado. */
  const quinas = c.createLinearGradient(0, 0, 0, alt);
  quinas.addColorStop(0, 'rgba(0,0,0,0.85)');
  quinas.addColorStop(0.18, 'rgba(0,0,0,0)');
  quinas.addColorStop(0.82, 'rgba(0,0,0,0)');
  quinas.addColorStop(1, 'rgba(0,0,0,0.85)');
  c.fillStyle = quinas;
  c.fillRect(0, 0, larg, alt);

  return cv;
}
