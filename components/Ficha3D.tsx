'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { desenharFace, desenharLateral } from './fichaTextura';

/* A ficha 3D que assume quando o vídeo termina e atravessa a página.
 *
 * ---------------------------------------------------------------- a emenda
 *
 * O único momento que importa é o primeiro. Se a ficha 3D nascer com tamanho
 * ou posição diferentes do último quadro do vídeo, a troca aparece, e não tem
 * como disfarçar depois.
 *
 * Por isso a emenda é CALIBRADA, não ajustada no olho. O último quadro do
 * vídeo foi medido: a ficha está a 0,0% do centro na horizontal, 0,3% na
 * vertical, e ocupa 64% da altura do quadro. Daí sai a distância da câmera por
 * equação:
 *
 *   altura visível = 2 · distância · tan(fov / 2)
 *   ocupação       = diâmetro / altura visível
 *   distância      = raio / (ocupação · tan(fov / 2))
 *
 * Com raio 1, fov 30° e ocupação 0,64, a câmera fica em 5,83. Nenhum número
 * foi escolhido a dedo.
 *
 * O tom também saiu de medição, e a conclusão foi contra a intuição: a queda
 * de luz da face NÃO pode vir da iluminação. Face plana sob luz direcional
 * recebe a mesma intensidade em todo ponto, porque a normal não muda, e o
 * disco sai chapado. O volume mora na textura (ver `fichaTextura.ts`); a luz
 * daqui serve para a borda e para a lateral, que são as partes curvas.
 */

const FOV = 30;
const RAIO = 1;
const ESPESSURA = 0.14;
const OCUPACAO_INICIAL = 0.64; // medido no último quadro do vídeo

/** Distância de câmera para a ficha ocupar `fracao` da altura da tela. */
function distanciaPara(fracao: number) {
  return RAIO / (fracao * Math.tan((FOV / 2) * (Math.PI / 180)));
}

const DISTANCIA = distanciaPara(OCUPACAO_INICIAL);
/** Meia altura da cena em unidades de mundo, no plano z = 0. */
const MEIA_ALTURA = Math.tan((FOV / 2) * (Math.PI / 180)) * DISTANCIA;

/* Quanto da ALTURA da tela a ficha do vídeo ocupa, nesta janela.
 *
 * Os 64% foram medidos no arquivo, que é 1920x1080. Mas o vídeo entra com
 * `object-fit: cover`, e cover escolhe o fator de escala pelo lado que falta:
 * numa janela mais alta que 16:9 ele encaixa pela altura e os 64% valem; numa
 * mais LARGA que 16:9 ele encaixa pela largura, o quadro inteiro cresce, e a
 * ficha do vídeo passa dos 64%.
 *
 * Sem isto a emenda fecharia em 1440x900 e em 1920x1080 (que é 16:9 exato) e
 * se abriria sozinha num monitor ultrawide, que é justamente onde ninguém
 * testa. */
const VIDEO_W = 1920;
const VIDEO_H = 1080;
function ocupacaoNaJanela(largura: number, altura: number) {
  const escala = Math.max(largura / VIDEO_W, altura / VIDEO_H);
  return (OCUPACAO_INICIAL * VIDEO_H * escala) / altura;
}

/* A pilha final: o destino do percurso.
 *
 * Fica à direita e embaixo porque o fecho da página é texto centralizado. A
 * pilha existe para ser vista, não para disputar a leitura com a frase que
 * pede o clique. */
const PILHA_FICHAS = 7;
const PILHA_ESCALA = 0.30;
const PILHA_X = 1.42;
const PILHA_Y = -MEIA_ALTURA * 0.56;
const INCLINACAO = -1.32; // radianos: quase de perfil, mostrando só uma lasca do topo

/* Onde pousa a ficha que chega, em coordenadas de mundo.
 *
 * É o mesmo lugar que a oitava ficha da pilha ocuparia, e por isso é
 * calculado, não estimado: aplicar na mão a mesma rotação e a mesma escala que
 * o grupo da pilha aplica nos filhos dele. Chutar esse ponto faria a ficha
 * pousar perto da pilha, e "perto" é exatamente o que se enxerga. */
/* A ficha chega girando, e o giro precisa terminar numa volta FECHADA.
   Parar no meio de uma volta deixa a peça de cima com orientação própria, e
   uma pilha com a ficha de cima torta não lê como pilha. */
const GIRO_INTEIRO = Math.PI * 2;

const ALTURA_PILHA = PILHA_FICHAS * ESPESSURA;
const TOPO_Y = PILHA_Y - ALTURA_PILHA * Math.sin(INCLINACAO) * PILHA_ESCALA;
const TOPO_Z = ALTURA_PILHA * Math.cos(INCLINACAO) * PILHA_ESCALA;

/* O percurso. Cada marco é uma pose, e o que roda entre eles é interpolação.
   `p` é o progresso da página inteira depois do herói, de 0 a 1.

   A regra que define os valores de `x`: a ficha nunca encosta na borda. Ficha
   cortada pela lateral não lê como movimento, lê como erro de posicionamento.
   Na tela mais estreita que ainda roda a cena, a meia largura da cena é
   `MEIA_ALTURA · proporção`, e os marcos ficam com folga dentro disso. */
type Pose = { x: number; y: number; z: number; escala: number; giroX: number; giroY: number; giroZ: number };

const MARCOS: { em: number; pose: Pose }[] = [
  /* a emenda: exatamente onde o vídeo deixou, centrada e de frente */
  { em: 0.00, pose: { x: 0.00, y: 0.00, z: 0, escala: 1.00, giroX: 0, giroY: 0, giroZ: 0 } },
  /* a dor: recua para a direita, encolhendo, e começa a virar de lado */
  { em: 0.22, pose: { x: 1.30, y: -0.42, z: 0, escala: 0.38, giroX: 0.10, giroY: -0.9, giroZ: 0.22 } },
  /* os três passos: atravessa para a esquerda, mais alta */
  { em: 0.45, pose: { x: -1.34, y: 0.24, z: 0, escala: 0.32, giroX: -0.14, giroY: -2.2, giroZ: -0.18 } },
  /* os recursos: volta à direita, quase de perfil */
  { em: 0.70, pose: { x: 1.28, y: -0.16, z: 0, escala: 0.30, giroX: 0.12, giroY: -3.4, giroZ: 0.26 } },
  /* os preços: desce deitando, já na inclinação da pilha */
  { em: 0.88, pose: { x: PILHA_X, y: TOPO_Y + 0.70, z: TOPO_Z, escala: PILHA_ESCALA, giroX: INCLINACAO * 0.75, giroY: -5.4, giroZ: 0 } },
  /* o fecho: pousa como a ficha de cima da pilha */
  { em: 1.00, pose: { x: PILHA_X, y: TOPO_Y, z: TOPO_Z, escala: PILHA_ESCALA, giroX: INCLINACAO, giroY: -GIRO_INTEIRO, giroZ: 0 } },
];

function interpolar(p: number): Pose {
  let a = MARCOS[0];
  let b = MARCOS[MARCOS.length - 1];
  for (let i = 0; i < MARCOS.length - 1; i++) {
    if (p >= MARCOS[i].em && p <= MARCOS[i + 1].em) {
      a = MARCOS[i];
      b = MARCOS[i + 1];
      break;
    }
  }
  const bruto = b.em === a.em ? 0 : (p - a.em) / (b.em - a.em);
  /* Suavização nas pontas: interpolação linear faz a ficha "bater" ao chegar
     em cada marco, e o olho lê isso como falha, não como escolha. */
  const t = bruto * bruto * (3 - 2 * bruto);
  const m = (k: keyof Pose) => a.pose[k] + (b.pose[k] - a.pose[k]) * t;
  return { x: m('x'), y: m('y'), z: m('z'), escala: m('escala'), giroX: m('giroX'), giroY: m('giroY'), giroZ: m('giroZ') };
}

export function Ficha3D({
  progresso,
  visivel,
}: {
  /** 0 no fim do herói, 1 no fim da página. */
  progresso: number;
  visivel: boolean;
}) {
  const tela = useRef<HTMLCanvasElement>(null);
  const cena = useRef<{
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    scene: THREE.Scene;
    ficha: THREE.Group;
    pilha: THREE.Group;
  } | null>(null);
  const alvo = useRef(0);

  useEffect(() => {
    const cv = tela.current;
    if (!cv) return;

    const renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    camera.position.z = DISTANCIA;

    /* Luz de cima à esquerda, fosca, sem especular forte: o vídeo tem só 2,7%
       de pixels quentes na face, abaixo do limite que caracteriza reflexo. */
    const chave = new THREE.DirectionalLight(0xfff2dd, 3.0);
    chave.position.set(-1.1, 1.4, 2.2);
    const ambiente = new THREE.AmbientLight(0x6b5a44, 1.6);
    const contra = new THREE.DirectionalLight(0xc49c5c, 0.5);
    contra.position.set(1.6, -0.8, -1.2);
    scene.add(chave, ambiente, contra);

    /* Materiais e geometrias nascem UMA vez e são compartilhados por todas as
       fichas. A pilha tem oito peças; oito cópias da textura de 1024px seriam
       oito envios para a placa de vídeo desenhando exatamente a mesma coisa. */
    const face = new THREE.CanvasTexture(desenharFace(1024));
    face.colorSpace = THREE.SRGBColorSpace;
    /* A tampa do cilindro do three tem UV girada um quarto de volta em relação
       ao desenho. Sem isto o logotipo sai deitado, lendo de baixo para cima. */
    face.center.set(0.5, 0.5);
    face.rotation = Math.PI / 2;
    face.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const lateral = new THREE.CanvasTexture(desenharLateral());
    lateral.colorSpace = THREE.SRGBColorSpace;
    lateral.wrapS = THREE.RepeatWrapping;

    const materialFace = new THREE.MeshStandardMaterial({ map: face, roughness: 0.72, metalness: 0.08 });
    const materialLado = new THREE.MeshStandardMaterial({ map: lateral, roughness: 0.8, metalness: 0.05 });
    /* O bisel: no vídeo a aresta arredondada chega a 206 de claridade contra
       60 do miolo, e é esse contorno aceso que faz a peça parecer um objeto e
       não um adesivo. Metalness alta ficaria PRETA aqui: sem mapa de ambiente
       um metal não tem o que refletir. Por isso quase zero. */
    const materialBisel = new THREE.MeshStandardMaterial({ color: 0x6f665e, roughness: 0.5, metalness: 0.06 });

    const geoCorpo = new THREE.CylinderGeometry(RAIO, RAIO, ESPESSURA, 96);
    /* Raio + tubo do toro tem que fechar EXATAMENTE no raio do corpo. Um fio a
       mais e o bisel aparece como duas orelhas claras saindo da silhueta
       quando a ficha gira de perfil. E o tubo tem que ser fino: bisel grosso
       vira um anel claro que engole a lateral, e a pilha passa a parecer uma
       pilha de argolas em vez de fichas. */
    const TUBO = ESPESSURA * 0.26;
    const geoBisel = new THREE.TorusGeometry(RAIO - TUBO, TUBO, 12, 128);

    /** Uma ficha pronta: corpo mais bisel, com a face voltada para a câmera. */
    const criarFicha = () => {
      const g = new THREE.Group();
      const corpo = new THREE.Mesh(geoCorpo, [materialLado, materialFace, materialFace]);
      /* O cilindro do three nasce em pé; deitar em X põe a face para a câmera. */
      corpo.rotation.x = Math.PI / 2;
      g.add(corpo, new THREE.Mesh(geoBisel, materialBisel));
      return g;
    };

    const ficha = criarFicha();
    scene.add(ficha);

    /* A pilha. Cada ficha ganha um giro próprio em torno do eixo: pilha de
       fichas de verdade nunca fica com os encaixes alinhados, e alinhados é
       justamente o que faz um render parecer render. */
    const pilha = new THREE.Group();
    pilha.position.set(PILHA_X, PILHA_Y, 0);
    pilha.rotation.x = INCLINACAO;
    pilha.scale.setScalar(PILHA_ESCALA);
    for (let i = 0; i < PILHA_FICHAS; i++) {
      const f = criarFicha();
      f.position.z = i * ESPESSURA;
      f.rotation.z = (i * 2.399) % (Math.PI * 2); // ângulo áureo: nunca repete
      pilha.add(f);
    }
    pilha.visible = false;
    scene.add(pilha);

    cena.current = { renderer, camera, scene, ficha, pilha };

    let raf = 0;
    let largura = 0;
    let altura = 0;

    const medir = () => {
      largura = cv.clientWidth;
      altura = cv.clientHeight;
      if (!largura || !altura) return;
      renderer.setSize(largura, altura, false);
      camera.aspect = largura / altura;
      camera.position.z = distanciaPara(ocupacaoNaJanela(largura, altura));
      camera.updateProjectionMatrix();
    };

    const desenhar = () => {
      raf = requestAnimationFrame(desenhar);
      const c = cena.current;
      if (!c || !largura) return;
      const p = alvo.current;
      const pose = interpolar(p);
      c.ficha.position.set(pose.x, pose.y, pose.z);
      c.ficha.scale.setScalar(pose.escala);
      c.ficha.rotation.set(pose.giroX, pose.giroY, pose.giroZ);

      /* A pilha só existe no fim. Antes disso seria um objeto parado num canto,
         sem explicação, disputando atenção com o texto que está sendo lido. */
      const entrada = Math.min(1, Math.max(0, (p - 0.74) / 0.10));
      c.pilha.visible = entrada > 0;
      c.pilha.scale.setScalar(PILHA_ESCALA * entrada);

      c.renderer.render(c.scene, c.camera);
    };

    const ro = new ResizeObserver(medir);
    ro.observe(cv);
    medir();
    desenhar();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      face.dispose();
      lateral.dispose();
      materialFace.dispose();
      materialLado.dispose();
      materialBisel.dispose();
      geoCorpo.dispose();
      geoBisel.dispose();
      renderer.dispose();
      cena.current = null;
    };
  }, []);

  useEffect(() => {
    alvo.current = progresso;
  }, [progresso]);

  return (
    <canvas
      ref={tela}
      aria-hidden
      className="pointer-events-none fixed inset-0 h-full w-full transition-opacity duration-300"
      style={{ opacity: visivel ? 1 : 0, zIndex: 5 }}
    />
  );
}
