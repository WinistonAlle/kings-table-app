# Scripts de verificação

Não são testes automatizados, são **medições**. Cada um sobe um Chrome sem
janela, abre a página e devolve números ou capturas. Foi assim que quase toda
decisão desta landing foi tomada: medindo antes e depois, em vez de julgar no
olho.

## Antes de rodar

```bash
npm run build
npx next start -p 3210     # todos os scripts apontam para esta porta
```

E rode com `node scripts/<nome>.js`.

## De onde vem o Puppeteer

Os scripts importam o `puppeteer-core` instalado no **projeto do portfólio**:

```js
require('/Users/winistonalle/Desktop/projetos/pessoal/portfolio/node_modules/puppeteer-core')
```

Foi para não adicionar 300 MB de dependência de teste a este repositório. Se
esse caminho deixar de existir, ou instale `puppeteer-core` aqui como
`devDependency`, ou corrija o caminho no topo de cada arquivo.

O Chrome é o do sistema, e o WebGL roda por software:

```js
args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']
```

Sem esses argumentos a cena 3D não desenha no headless e as capturas saem sem
a ficha.

## O que cada um faz

| Script | Devolve |
|---|---|
| `larguras.js` | Estouro horizontal, número de canvas, presença do vídeo e erros de página em 390, 768, 1440 e 1920. **É o teste que toda mudança de layout tem que passar.** |
| `dobras.js` | A tabela de frações do percurso da ficha: topo, altura e centro de cada dobra. Rode sempre que mexer na estrutura da página e compare com os `MARCOS` de `Ficha3D.tsx` (ver a seção 9 do `PROJETO.md`). |
| `mesa3d.js` | Captura a dobra da mesa em várias posições de rolagem e mede os limites do feltro. Serve para confirmar que a mesa continua **fixa**: os quatro números têm que ser idênticos entre posições. |
| `tour.js` | Uma captura por dobra, para olhar a página inteira de uma vez. |
| `piscada.js` | Brilho médio quadro a quadro na troca vídeo para 3D. Foi como a piscada da emenda foi diagnosticada e conferida (de +3,91 para +0,42). |
| `pousa.js`, `pouso.js` | Onde a ficha viajante pousa em relação à pilha de destino. |
| `faixa.js`, `fluidez.js`, `texto.js` | Auxiliares da calibração da ficha e da tipografia. |

## O detalhe que faz um script mentir

**O Lenis intercepta `window.scrollTo`.** Um script que chama `scrollTo` e tira
print imediatamente **não está na posição que pediu**, e o sintoma é uma série
de leituras não monotônicas que parecem bug na página e são bug no teste.

`mesa3d.js` já tem a correção: um laço que confirma o `scrollY` real com
tolerância de 8px antes de capturar. Qualquer script novo que role a página
precisa fazer o mesmo.
