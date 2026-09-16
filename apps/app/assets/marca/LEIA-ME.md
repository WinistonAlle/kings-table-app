# Marca do King's Table

`marca.svg` — a marca completa: coroa, quadro e leão. **Use acima de 48px.**
`coroa.svg` — só a coroa. É a forma reduzida, para favicon e ícone miúdo.

## De onde veio

A marca existia só como JPEG de WhatsApp, sem vetor original. Este SVG foi
traçado a partir daquela imagem: dourado isolado por distância de cor, bitmap
ampliado 4x antes de binarizar, e traçado com o alisamento de curvas
**desligado** — o desenho é todo em ângulo, e o padrão do vetorizador
arredondaria os bicos da juba e da coroa. Resultado: 84 pontos, só retas.

## Uma correção deliberada

No arquivo original o quadro media 364 x 355 px, 2,54% mais largo que alto.
Parecia esticamento horizontal de algum export, então a escala em x foi
corrigida e o quadro está agora em 1,0055 de proporção. Se um dia aparecer o
arquivo original e ele for mesmo retangular, é aqui que a decisão está
registrada.

## Por que existe uma forma reduzida

A marca completa some abaixo de ~40px: as listras da juba fundem e o leão vira
mancha. Isso é característica de marca detalhada, não defeito. Abaixo disso,
usar `coroa.svg`, que continua legível a 16px.

## Cor

O ouro da marca é `#c49c5c` (matiz 37°). É a âncora da paleta inteira do app:
`Colors.gold400` em `constants/tokens.ts` é exatamente esta cor, e o resto da
escala é a mesma matiz em luminosidades diferentes. Os SVGs usam
`fill="currentColor"`, então herdam a cor de quem os desenha.
