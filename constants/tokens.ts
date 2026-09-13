/* Sistema visual do King's Table.
 *
 * A referência é um clube privado: convite em letterpress, ficha de cassino,
 * pano de mesa. Não é "app escuro com detalhe dourado" — a diferença entre uma
 * coisa e outra está em três decisões que este arquivo carrega:
 *
 * 1. LUZ. Preto chapado é papel, não material. Toda superfície elevada ganha um
 *    fio de luz na aresta de cima e sombra embaixo, como se houvesse uma
 *    lâmpada acima da mesa. É de onde vem a sensação de objeto.
 * 2. OURO COM PARCIMÔNIA. Ouro marca UMA coisa por tela. Quando ele está no
 *    ícone, na borda, no rótulo, no número e no botão ao mesmo tempo, para de
 *    significar qualquer coisa e vira só a cor do app.
 * 3. ESCALA COM SALTO. Hierarquia tímida (15px, 16px, 17px) lê como planilha.
 *    Os saltos aqui são grandes de propósito: ou a coisa é herói, ou é apoio.
 */

export const Colors = {
  /* Os pretos não são neutros: puxam para o quente (marrom), que é o que
     diferencia "veludo" de "desligado". */
  bg0: '#0a0807',
  bg1: '#11100e',
  bg2: '#1a1816',
  bg3: '#242220',
  bg4: '#2e2b28',

  text0: '#f5ede0',
  text1: '#c9bda6',
  text2: '#7a7366',
  text3: '#4a463f',

  /* A escala inteira é ancorada na LOGO: `gold400` é exatamente o ouro do
     leão (#c49c5c, matiz 37°), e todos os outros degraus são a mesma matiz em
     luminosidades diferentes.

     Antes a escala andava entre 40° e 45°, ou seja, de sete a oito graus mais
     amarela que a marca. Sozinha ninguém notava; ao lado da logo, a interface
     puxava para champagne enquanto o leão puxava para bronze, e ela lia como
     se tivesse vindo de outro lugar.

     As luminosidades são as mesmas de antes de propósito: só a temperatura
     mudou, então nenhum contraste de texto quebrou. */
  gold50:  '#f3e5cd',
  gold100: '#e7d0ac',
  gold200: '#e3cba6',
  gold300: '#d3b27e',
  gold400: '#c49c5c',
  gold500: '#8b6d3c',
  gold600: '#5b4829',
  gold700: '#342918',
  gold800: '#1e1910',

  /* Verde de pano de mesa. Entra como sugestão, nunca como área grande. */
  accent:    '#3d8a6a',
  accentDim: '#1f4a38',

  red:    '#c85a5a',
  ok:     '#78a885',
  warn:   '#d9a74a',
  danger: '#c85a5a',

  border:       'rgba(227, 203, 166, 0.08)',
  borderStrong: 'rgba(227, 203, 166, 0.18)',
  borderHot:    'rgba(227, 203, 166, 0.32)',

  /* Fio de luz no topo de uma superfície elevada, e a sombra que o acompanha. */
  luzTopo: 'rgba(255, 250, 235, 0.07)',
  sombra:  'rgba(0, 0, 0, 0.55)',
} as const;

export const Fonts = {
  display:        'CormorantGaramond_500Medium',
  displayItalic:  'CormorantGaramond_500Medium_Italic',
  displaySemi:    'CormorantGaramond_600SemiBold',
  displayBold:    'CormorantGaramond_700Bold',
  ui:             'InterTight_400Regular',
  uiMedium:       'InterTight_500Medium',
  uiSemiBold:     'InterTight_600SemiBold',
  uiBold:         'InterTight_700Bold',
  /* Algarismos. DM Mono no lugar da JetBrains: passo fixo igual, desenho de
     tipógrafo em vez de desenho de editor de código. */
  mono:           'DMMono_300Light',
  monoMedium:     'DMMono_400Regular',
  monoBold:       'DMMono_500Medium',
} as const;

export const Radius = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 9999,
} as const;

/* Escala de espaço em múltiplos de 4. Existir como escala, e não como número
   solto em cada tela, é o que faz uma tela parecer irmã da outra. */
export const Space = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48, hero: 64,
} as const;

/* Escala tipográfica com saltos grandes. Os nomes dizem o PAPEL, não o
   tamanho: quem escreve tela pede "hero" ou "legenda", nunca "28px". */
/* `fontSize` e não `size`: são estilos de texto do React Native, aplicados
   direto. Chamar a chave de `size` fazia o RN ignorar a propriedade inteira e
   TODO texto do app cair no corpo padrão de 14px — com o relógio e o nome do
   clube saindo do tamanho de uma legenda. */
export const Type = {
  /* Números que são o assunto da tela: o relógio, o prize pool. */
  hero:     { fontSize: 68, lineHeight: 74, letterSpacing: -1.5 },
  /* Nome de torneio, nome de tela. */
  titulo:   { fontSize: 34, lineHeight: 40, letterSpacing: -0.4 },
  subtitulo:{ fontSize: 23, lineHeight: 30, letterSpacing: -0.2 },
  corpo:    { fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  apoio:    { fontSize: 13, lineHeight: 19, letterSpacing: 0 },
  /* Caixa alta com entreletra larga: rótulo de gravação, não frase. */
  rotulo:   { fontSize: 10, lineHeight: 14, letterSpacing: 1.6 },
} as const;

/* Receitas de elevação. Sombra sozinha no escuro some; o que faz a superfície
   existir é a combinação de sombra embaixo com o fio de luz em cima, e este
   último é uma borda, não uma sombra (RN não tem `inset`). */
export const Elevacao = {
  plana: {},
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  alta: {
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  /* Brilho de ouro, para o único elemento em foco na tela. */
  ouro: {
    shadowColor: Colors.gold300,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
} as const;

/* Degradês nomeados, para as telas não repetirem paradas de cor na mão. */
export const Degrade = {
  /* Fundo de tela: um clarão quente no alto, como luminária sobre a mesa. */
  fundo: ['#1b1510', '#0d0b09', Colors.bg0] as const,
  /* Superfície elevada: some de cima para baixo, imitando queda de luz. */
  superficie: ['rgba(255,250,235,0.055)', 'rgba(255,250,235,0.012)'] as const,
  /* Ouro de botão: claro em cima, escuro embaixo. É o que faz parecer metal
     em vez de retângulo amarelo. */
  ouro: [Colors.gold100, Colors.gold300] as const,
  /* Arco do relógio. */
  arco: [Colors.gold50, Colors.gold400, Colors.gold600] as const,
} as const;
