'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { desenharLateral } from './fichaTextura';

/* A ficha 3D que assume quando o vídeo termina e atravessa a página.
 *
 * ---------------------------------------------------------------- a emenda
 *
 * O único momento que não perdoa erro é o primeiro. Se a ficha 3D nascer com
 * tamanho, posição ou cor diferentes do último quadro do vídeo, a troca
 * aparece, e não tem como disfarçar depois.
 *
 * Por isso nada aqui foi ajustado no olho:
 *
 * - TAMANHO E POSIÇÃO saem de equação. O disco foi medido no quadro final
 *   (centro (950, 540), raio 351 num quadro de 1920x1080, ou seja 64% da
 *   altura) e a distância da câmera vem de
 *   `raio / (ocupação · tan(fov/2))`.
 *
 * - A COR é o próprio quadro. A face é um recorte do último frame do vídeo, e
 *   não um redesenho: iluminação, textura de couro e granulado de compressão
 *   estão assados no pixel, e reproduzir isso desenhando chega perto e erra.
 *   A consequência importante vem a seguir.
 *
 * - A LUZ da cena quase não toca a face. Se a face já vem com o claro e o
 *   escuro do vídeo dentro dela, iluminá-la de novo multiplicaria a sombra
 *   duas vezes e o tom fugiria na hora da troca. Então a face é levada quase
 *   como está (`emissiveMap` carregando a maior parte) e a luz fica para o
 *   bisel e para a lateral, que são as partes curvas e as únicas que precisam
 *   responder ao giro.
 */

const FOV = 30;
const RAIO = 1;
const ESPESSURA = 0.14;
const OCUPACAO_INICIAL = 0.64; // medido no último quadro do vídeo
const VIDEO_W = 1920;
const VIDEO_H = 1080;

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
 * `object-fit: cover`, e cover escolhe a escala pelo lado que falta: numa
 * janela mais alta que 16:9 ele encaixa pela altura e os 64% valem; numa mais
 * LARGA que 16:9 ele encaixa pela largura, o quadro cresce inteiro, e a ficha
 * do vídeo passa dos 64%. Sem esta conta a emenda fecharia em 1440x900 e se
 * abriria sozinha num ultrawide, que é justamente onde ninguém testa. */
/* A ficha do vídeo NÃO está no centro do quadro: o disco foi medido em
 * x = 950 num quadro de 1920, ou seja 10px à esquerda do meio. Dez pixels
 * parecem nada até a ficha 3D nascer centrada em cima dela: a medição do
 * quadro da emenda acusou 8px de descasamento, e 8px de salto lateral no
 * instante da troca é exatamente o tipo de coisa que o olho pega sem saber
 * dizer o que viu.
 *
 * Guardado como fração da ALTURA do quadro porque é a altura que o `cover`
 * amarra à tela; converter para unidades de mundo depende da câmera, que muda
 * com a proporção da janela, então a conta fica na hora de desenhar. */
const CENTRO_VIDEO_X = 950;
const DESLOCAMENTO_X = (CENTRO_VIDEO_X - VIDEO_W / 2) / VIDEO_H;

function ocupacaoNaJanela(largura: number, altura: number) {
  const escala = Math.max(largura / VIDEO_W, altura / VIDEO_H);
  return (OCUPACAO_INICIAL * VIDEO_H * escala) / altura;
}

/* ------------------------------------------------------------ a pilha final */

const INCLINACAO = -1.32; // quase de perfil, mostrando só uma lasca do topo
const PILHA_ESCALA = 0.26;
const PILHA_Y = -MEIA_ALTURA * 0.52;

/** As pilhas do fecho. Alturas desiguais de propósito: três pilhas iguais lado
 *  a lado lê como gráfico de barras, não como dinheiro em cima da mesa. */
const PILHAS = [
  { x: 0.82, fichas: 7, z: -0.30 },
  { x: 1.36, fichas: 13, z: 0.00 },
  { x: 1.86, fichas: 9, z: -0.16 },
];
/** Em qual delas a ficha viajante pousa: a mais alta, no meio. */
const PILHA_DESTINO = 1;

/* A ficha chega girando, e o giro precisa terminar numa volta FECHADA. Parar
   no meio de uma volta deixa a peça de cima com orientação própria, e pilha
   com a ficha de cima torta não lê como pilha. */
const GIRO_INTEIRO = Math.PI * 2;

/* Onde pousa a ficha que chega, em coordenadas de mundo.
 *
 * É o lugar que a próxima ficha da pilha do meio ocuparia, e por isso é
 * calculado, não estimado: aplicar na mão a mesma rotação e a mesma escala que
 * o grupo da pilha aplica nos filhos. Chutar esse ponto faria a ficha pousar
 * PERTO da pilha, e "perto" é exatamente o que se enxerga. */
const ALTURA_DESTINO = PILHAS[PILHA_DESTINO].fichas * ESPESSURA;
const TOPO_X = PILHAS[PILHA_DESTINO].x;
const TOPO_Y = PILHA_Y - ALTURA_DESTINO * Math.sin(INCLINACAO) * PILHA_ESCALA;
const TOPO_Z = PILHAS[PILHA_DESTINO].z + ALTURA_DESTINO * Math.cos(INCLINACAO) * PILHA_ESCALA;

/* ---------------------------------------------------------------- o percurso */

/* Cada marco é uma pose, e o que roda entre eles é interpolação. `p` é o
   progresso da página inteira depois do herói, de 0 a 1.

   A regra que define os valores de `x`: a ficha nunca encosta na borda. Ficha
   cortada pela lateral não lê como movimento, lê como erro de posicionamento. */
/* Onde a ficha para, e por quanto tempo de rolagem.
 *
 * Exportado porque o anel de texto precisa saber EXATAMENTE onde ela está na
 * tela para girar em volta dela. Duas fontes de verdade para a mesma posição
 * seria o tipo de coisa que funciona no dia em que se escreve e se desencontra
 * no primeiro ajuste. */
export const POSE_PAUSA = {
  /* A pausa acontece na dobra da PROMESSA, que é a primeira depois do herói.
     Medido na página montada: aquela dobra ocupa o percurso de 0,10 a 0,13 e
     tem o centro em 0,117. A janela é mais larga que isso de propósito — ela
     começa em 0,05, quando a ficha mal saiu da maleta, para o anel de texto
     já estar girando quando a frase entra em quadro. Era esse "começar um
     pouco antes" que faltava.

     Narrativamente é o lugar certo: a peça acabou de sair do vídeo e esta é a
     primeira vez que ela fica quieta para alguém olhar. */
  de: 0.05,
  ate: 0.19,
  /* `x` e `escala` saem da largura que a dobra cede: o texto ocupa 62% da
     coluna (144..858 em 1440px) e a ficha fica no que sobra. Com escala 0,62
     o anel mede ~490px e cai entre 874 e 1366 — 16px do texto, 74px da borda.
     Anel que encosta no texto deixa de ser objeto e vira acidente. */
  /* `y` positivo sobe a peça. Em -0,05 ela ficava no meio da tela, e como o
     anel é fixo na viewport enquanto o texto rola, havia um trecho em que a
     ficha aparecia ABAIXO da frase e já invadindo a dobra seguinte. Em 0,30
     ela fica na altura do bloco de texto durante toda a passagem. */
  pose: { x: 1.389, y: 0.30, z: 0, escala: 0.62, giroX: 0.05, giroY: -0.42, giroZ: 0.08 },
};


/* Onde um ponto do mundo aparece na tela, em pixels.
 *
 * A câmera é perspectiva, olhando para a origem, e a ficha vive no plano
 * z = 0 — o que torna a conta uma regra de três, sem matriz nenhuma: a meia
 * altura visível nesse plano é `tan(fov/2) · distância`, e a meia largura é
 * isso vezes a proporção da janela.
 *
 * `distanciaPara(ocupacaoNaJanela(...))` é a MESMA chamada que a cena faz ao
 * redimensionar. Repetir a fórmula aqui em vez de reusar a função seria criar
 * a chance de as duas divergirem justamente numa janela fora do comum, que é
 * onde ninguém testa. */
export function projetar(
  ponto: { x: number; y: number; escala: number },
  largura: number,
  altura: number,
) {
  const dist = distanciaPara(ocupacaoNaJanela(largura, altura));
  const meiaAltura = Math.tan((FOV / 2) * (Math.PI / 180)) * dist;
  const meiaLargura = meiaAltura * (largura / altura);
  const pxPorUnidade = altura / 2 / meiaAltura;
  return {
    centroX: largura / 2 + (ponto.x / meiaLargura) * (largura / 2),
    centroY: altura / 2 - (ponto.y / meiaAltura) * (altura / 2),
    diametro: 2 * RAIO * ponto.escala * pxPorUnidade,
  };
}

/* As frações NÃO são escolhidas no olho: são o centro de cada dobra, medido
   na página montada. Em 1440x900 o percurso depois do herói tem 6221px e os
   centros caem em 0,18 (antes e depois), 0,47 (recursos), 0,74 (preços),
   0,88 (perguntas) e 0,99 (lista). Mexer na estrutura da página move esses
   números, e é por isso que remexer as dobras obriga a remedir aqui — senão
   a ficha passa a parar entre duas seções, que é onde ninguém está olhando. */
type Pose = { x: number; y: number; z: number; escala: number; giroX: number; giroY: number; giroZ: number };

const MARCOS: { em: number; pose: Pose }[] = [
  /* a emenda: exatamente onde o vídeo deixou, centrada e de frente */
  { em: 0.00, pose: { x: 0.00, y: 0.00, z: 0, escala: 1.00, giroX: 0, giroY: 0, giroZ: 0 } },
  /* antes e depois: recua para a direita, encolhendo, e começa a virar */
  /* A PAUSA. Dois marcos com a pose IDÊNTICA: entre eles a interpolação não
     tem o que interpolar, e a ficha fica parada de verdade — inclusive a
     rotação, que é o que costuma denunciar uma pausa falsa. É neste trecho
     que o anel de texto gira em volta dela (ver `AnelTexto.tsx`), e o efeito
     só funciona se a peça estiver mesmo imóvel: anel girando em volta de uma
     ficha que também gira vira duas coisas girando. */
  { em: POSE_PAUSA.de, pose: POSE_PAUSA.pose },
  { em: POSE_PAUSA.ate, pose: POSE_PAUSA.pose },
  /* recursos: atravessa para a esquerda, mais alta */
  { em: 0.47, pose: { x: -1.34, y: 0.24, z: 0, escala: 0.32, giroX: -0.14, giroY: -2.2, giroZ: -0.18 } },
  /* preços: volta à direita, quase de perfil */
  { em: 0.74, pose: { x: 1.28, y: -0.16, z: 0, escala: 0.30, giroX: 0.12, giroY: -3.4, giroZ: 0.26 } },
  /* perguntas: desce deitando, já na inclinação da pilha */
  { em: 0.88, pose: { x: TOPO_X, y: TOPO_Y + 0.72, z: TOPO_Z, escala: PILHA_ESCALA, giroX: INCLINACAO * 0.75, giroY: -5.4, giroZ: 0 } },
  /* a lista de espera: pousa como a ficha de cima da pilha do meio */
  { em: 1.00, pose: { x: TOPO_X, y: TOPO_Y, z: TOPO_Z, escala: PILHA_ESCALA, giroX: INCLINACAO, giroY: -GIRO_INTEIRO, giroZ: 0 } },
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

/** Rampa de 0 a 1 entre `a` e `b`, com as pontas suaves. */
function faixa(v: number, a: number, b: number) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/* Quanto a mão da pessoa pode mexer na ficha, e ONDE ela não pode.
 *
 * O ponteiro inclina a ficha e a rolagem rápida a faz girar mais. Esses dois
 * efeitos somam em cima da pose do percurso, e por isso precisam VALER ZERO
 * nas duas pontas: no começo porque a emenda com o vídeo é exata, e no fim
 * porque a ficha tem que pousar alinhada com a pilha. No meio da página, que é
 * onde ela está só passeando, valem inteiros. */
const TILT_MAX = 0.20;       // radianos
const GIRO_POR_ROLAGEM = 7.0; // radianos por unidade de progresso por segundo
const ATRITO = 2.4;           // por segundo: o quanto o giro extra perde por si

export function Ficha3D({ progresso, visivel }: { progresso: number; visivel: boolean }) {
  const tela = useRef<HTMLCanvasElement>(null);
  const alvo = useRef(0);
  const cena = useRef<{
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    scene: THREE.Scene;
    ficha: THREE.Group;
    pilhas: THREE.Group[];
  } | null>(null);

  useEffect(() => {
    const cv = tela.current;
    if (!cv) return;

    const renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    camera.position.z = DISTANCIA;

    /* Luz para as partes curvas. A face não depende dela (ver o cabeçalho),
       então ela pode ser generosa com o bisel sem estourar o tom do disco. */
    const chave = new THREE.DirectionalLight(0xfff2dd, 2.4);
    chave.position.set(-1.1, 1.4, 2.2);
    const ambiente = new THREE.AmbientLight(0x8d7a5e, 1.4);
    const contra = new THREE.DirectionalLight(0xc49c5c, 0.6);
    contra.position.set(1.6, -0.8, -1.2);
    scene.add(chave, ambiente, contra);

    const face = new THREE.TextureLoader().load('/ficha-face.jpg');
    face.colorSpace = THREE.SRGBColorSpace;
    /* A tampa do cilindro do three tem UV girada um quarto de volta em relação
       ao recorte. Sem isto o logotipo sai deitado, lendo de baixo para cima. */
    face.center.set(0.5, 0.5);
    face.rotation = Math.PI / 2;
    face.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const lateral = new THREE.CanvasTexture(desenharLateral());
    lateral.colorSpace = THREE.SRGBColorSpace;
    lateral.wrapS = THREE.RepeatWrapping;

    /* A face entra quase inteira por `emissive`: é o que faz o pixel chegar à
       tela como está no arquivo. O pouco de `map` que sobra existe só para ela
       escurecer junto quando a ficha vira de costas para a luz. */
    const materialFace = new THREE.MeshStandardMaterial({
      map: face,
      emissive: 0xffffff,
      emissiveMap: face,
      /* A face chega à tela praticamente como está no arquivo, que é o
         pedido. Os 10% que faltam para 1.0 não são gosto: o herói tem um véu
         escuro na base do quadro que cai em cima do vídeo, e a textura foi
         recortada COM o véu desligado. Medido no quadro da emenda, o vídeo
         exibido fica 10% mais escuro que o arquivo; sem esta conta a ficha 3D
         nasceria clara demais em cima dele. O `color` quase preto deixa uma
         fresta para a luz, só o bastante para a face escurecer quando a ficha
         vira de costas. */
      emissiveIntensity: 0.79,
      roughness: 0.9,
      metalness: 0,
      color: 0x000000,
    });
    const materialLado = new THREE.MeshStandardMaterial({ map: lateral, roughness: 0.8, metalness: 0.05 });
    /* O bisel: no vídeo a aresta arredondada chega a 206 de claridade contra
       60 do miolo, e é esse contorno aceso que faz a peça parecer um objeto e
       não um adesivo. Metalness alta ficaria PRETA aqui: sem mapa de ambiente
       um metal não tem o que refletir. Por isso quase zero. */
        /* A cor saiu do anel externo da própria face do vídeo: no raio 0,88 o
       decil mais claro é (163,125,81), warm. Bisel cinza fazia a silhueta
       sumir no fundo e a ficha 3D parecer menor que a do vídeo. */
    const materialBisel = new THREE.MeshStandardMaterial({ color: 0x8a7358, roughness: 0.5, metalness: 0.06 });

    /* Raio + tubo do toro fecham EXATAMENTE no raio do corpo. Um fio a mais e
       o bisel aparece como duas orelhas claras saindo da silhueta quando a
       ficha gira de perfil. E o tubo tem que ser fino: bisel grosso vira um
       anel claro que engole a lateral, e a pilha passa a parecer uma pilha de
       argolas em vez de fichas. */
    const TUBO = ESPESSURA * 0.26;
    const geoCorpo = new THREE.CylinderGeometry(RAIO, RAIO, ESPESSURA, 96);
    const geoBisel = new THREE.TorusGeometry(RAIO - TUBO, TUBO, 12, 128);

    /* Geometrias e materiais nascem UMA vez e são compartilhados. A cena tem
       trinta fichas no fecho; trinta cópias de uma textura de 1024px seriam
       trinta envios para a placa desenhando a mesma coisa. */
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

    const pilhas = PILHAS.map(({ x, fichas, z }) => {
      const g = new THREE.Group();
      g.position.set(x, PILHA_Y, z);
      g.rotation.x = INCLINACAO;
      for (let i = 0; i < fichas; i++) {
        const f = criarFicha();
        f.position.z = i * ESPESSURA;
        /* Ângulo áureo: os encaixes nunca repetem alinhamento. Pilha de
           fichas de verdade nunca fica com as bordas casadas, e casadas é
           justamente o que faz um render parecer render. */
        f.rotation.z = (i * 2.39996) % (Math.PI * 2);
        /* Desencontro de um fio de cabelo: pilha perfeitamente prumada é a
           outra marca registrada de render. */
        f.position.x = Math.sin(i * 1.7) * 0.035;
        f.position.y = Math.cos(i * 2.3) * 0.035;
        g.add(f);
      }
      g.visible = false;
      scene.add(g);
      return g;
    });

    cena.current = { renderer, camera, scene, ficha, pilhas };

    /* ------------------------------------------------- a parte interativa */

    const ponteiro = { x: 0, y: 0 };   // -1..1, onde o cursor está
    const mao = { x: 0, y: 0 };        // o que a ficha já alcançou desse alvo
    let giroExtra = 0;                 // giro acumulado pela rolagem rápida
    let anterior = 0;                  // progresso do quadro passado
    let instante = performance.now();

    const aoMover = (e: PointerEvent) => {
      ponteiro.x = (e.clientX / window.innerWidth) * 2 - 1;
      ponteiro.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', aoMover, { passive: true });

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

    const desenhar = (agora: number) => {
      raf = requestAnimationFrame(desenhar);
      const c = cena.current;
      if (!c || !largura) return;

      /* Tudo que é físico aqui anda por SEGUNDO, não por quadro: num monitor
         de 120Hz um efeito por quadro corre com o dobro da velocidade. */
      const dt = Math.min(0.05, (agora - instante) / 1000);
      instante = agora;

      const p = alvo.current;
      const pose = interpolar(p);

      /* A licença para a mão interferir: zero nas duas pontas, inteira no
         meio. Ver o comentário de TILT_MAX. */
      const licenca = faixa(p, 0.02, 0.14) * (1 - faixa(p, 0.84, 0.97));

      /* Rolagem rápida empurra o giro; o atrito devolve a ficha ao percurso.
         Por isso é um empurrão e não uma posição: o efeito some sozinho
         quando a pessoa para, sem precisar de ninguém para desfazê-lo. */
      const velocidade = dt > 0 ? (p - anterior) / dt : 0;
      anterior = p;
      giroExtra += velocidade * GIRO_POR_ROLAGEM * dt;
      giroExtra -= giroExtra * Math.min(1, ATRITO * dt);

      /* A ficha persegue o ponteiro em vez de colar nele: colar transforma
         cada tremida da mão em tremida da ficha. */
      mao.x += (ponteiro.x - mao.x) * Math.min(1, dt * 3.2);
      mao.y += (ponteiro.y - mao.y) * Math.min(1, dt * 3.2);

      /* A compensação do quadro só vale enquanto a ficha ainda está no lugar
         do vídeo; assim que ela sai do centro, ninguém tem com o que comparar. */
      const meiaAltura = Math.tan((FOV / 2) * (Math.PI / 180)) * c.camera.position.z;
      const desloc = DESLOCAMENTO_X * 2 * meiaAltura * (1 - faixa(p, 0, 0.22));
      c.ficha.position.set(pose.x + desloc, pose.y, pose.z);
      c.ficha.scale.setScalar(pose.escala);
      c.ficha.rotation.set(
        pose.giroX + mao.y * TILT_MAX * licenca,
        pose.giroY + (giroExtra + mao.x * TILT_MAX) * licenca,
        pose.giroZ,
      );

      /* As pilhas só existem no fecho. Antes disso seriam objetos parados num
         canto, sem explicação, disputando atenção com o texto que está sendo
         lido. Entram uma depois da outra, de fora para dentro. */
      c.pilhas.forEach((g, i) => {
        /* 0,90 e não 0,70: com a estrutura de seis dobras, 0,70 cai no meio
           dos PREÇOS, e as pilhas apareceriam três dobras antes do lugar
           delas. Aqui elas sobem durante as perguntas e estão prontas quando
           a lista de espera entra em quadro. */
        const atraso = 0.90 + i * 0.02;
        const entrada = faixa(p, atraso, atraso + 0.10);
        g.visible = entrada > 0;
        g.scale.setScalar(PILHA_ESCALA * entrada);
        /* Enquanto sobem, as pilhas também se inclinam de leve com o ponteiro:
           é o que impede que pareçam um adesivo colado no canto. */
        g.rotation.y = mao.x * 0.09 * entrada;
      });

      c.renderer.render(c.scene, c.camera);
    };

    const ro = new ResizeObserver(medir);
    ro.observe(cv);
    medir();
    raf = requestAnimationFrame(desenhar);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', aoMover);
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
      className="pointer-events-none fixed inset-0 h-full w-full"
      /* Aparece INSTANTÂNEA, some com calma.
         Se ela entrasse suavizada, o corte da placa aconteceria com a ficha
         ainda translúcida — e por baixo dela estaria a maleta já vazia. A
         entrada não tem o que suavizar: a ficha nasce no lugar, no tamanho e
         na cor da que está no vídeo. A saída continua suave, porque aí não há
         nada por baixo para casar. */
      style={{
        opacity: visivel ? 1 : 0,
        zIndex: 5,
        transition: visivel ? 'none' : 'opacity 300ms ease',
      }}
    />
  );
}
