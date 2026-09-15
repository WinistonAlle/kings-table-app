# King's Table: a landing page

Documento de passagem. Escrito em 15/09/2026 para quem for continuar o
trabalho em outra ferramenta. Ele cobre o que o projeto é, como cada peça
funciona, por que cada decisão foi tomada, o que está pronto, o que falta e
onde estão as armadilhas.

Leia a seção **Armadilhas** antes de mexer em qualquer coisa. Quase toda ela
é um erro que já foi cometido aqui.

---

## 1. O que é

Landing page de produto para o **King's Table**, um aplicativo de organização
de home game de pôquer (relógio de blinds, controle de pagamento, premiação
calculada e ranking de temporada).

O aplicativo é outro projeto, em `~/Desktop/projetos/pessoal/kings-table-app/`
(Expo SDK 54 + Expo Router + Zustand + Supabase, iOS primeiro). Ele **ainda
não foi publicado**. Isso define tudo nesta página: não há para onde mandar
ninguém baixar, então o destino de todos os botões é uma **lista de espera por
e-mail**, e os preços aparecem como "em breve".

A regra de conteúdo que vale desde o começo: **só entra na página o que o
aplicativo faz hoje.** O que ainda não existe vai num bloco à parte,
explicitamente marcado, no fim da dobra de recursos. Misturar as duas coisas é
como se perde a confiança de quem compra.

### A ideia visual

A página inteira é guiada por rolagem e tem um fio condutor só: **uma ficha de
pôquer**.

1. O herói é um **vídeo de uma maleta de fichas** que não toca sozinho: a
   rolagem raspa o vídeo quadro a quadro. No fim dele, uma ficha está de frente
   para a câmera, no centro.
2. Exatamente nesse ponto, uma **ficha 3D em WebGL** acende por cima da ficha
   do vídeo, calibrada para o mesmo tamanho, a mesma posição e a mesma cor. O
   fundo do vídeo é trocado por uma foto idêntica **sem a ficha**, em corte
   seco. A leitura é: a peça saiu de dentro da maleta.
3. A partir daí a ficha 3D **atravessa a página inteira**, parando em dois
   lugares, até pousar numa pilha de fichas no fecho, junto com o formulário da
   lista de espera.

O terceiro ato é uma **mesa de pôquer 3D**, de ponta a ponta na tela, no mesmo
canvas e na mesma cena da ficha. A ficha viajante encolhe, pousa numa das
pilhas da mesa, e as outras pilhas vão sumindo conforme a rolagem avança: é a
noite acontecendo.

---

## 2. Como rodar

```bash
cd ~/Desktop/projetos/pessoal/kings-table-site
npm install
npm run dev            # desenvolvimento, porta 3000
```

Para testar de verdade (efeitos de rolagem e WebGL se comportam diferente em
produção):

```bash
npm run build
npx next start -p 3210
```

A porta 3210 é a que os scripts de verificação usam (seção 11).

### Verificação mínima antes de qualquer commit

```bash
npx tsc --noEmit && npm run build
```

Nada de `.env.local` existe no repositório hoje. Sem ele, a rota da lista de
espera responde 502 (ver seção 8). O resto da página funciona normalmente.

### Stack

| Peça | Versão | Por quê |
|---|---|---|
| Next.js | 16.3.5 (App Router, Turbopack) | |
| React | 19.2.8 | |
| Tailwind | 4, via `@theme` no CSS | Sem `tailwind.config.js`: os tokens vivem em `app/globals.css` |
| three.js | 0.186 | A ficha e a mesa, num único contexto WebGL |
| lenis | 1.3.26 | Rolagem suave (ver Armadilhas) |
| @supabase/supabase-js | 2.116 | Só no servidor, só para a lista de espera |

Sem biblioteca de animação (`framer-motion` e afins). Tudo que anima é CSS
(`@keyframes` e `transition`) ou `requestAnimationFrame` escrito à mão. Foi
decisão: a página já carrega um vídeo de 5 MB e uma cena 3D, e as animações
daqui são simples o bastante para não justificarem outro pacote.

---

## 3. Estado atual

### Pronto

- As sete dobras, com conteúdo final de texto
- O herói com vídeo raspado pela rolagem
- A emenda vídeo → ficha 3D, calibrada por medição
- O percurso da ficha 3D pela página inteira, com duas pausas
- O anel de texto girando em volta da ficha na primeira pausa
- A mesa de pôquer 3D, fixa, com as pilhas sumindo pela rolagem
- O fundo animado de raios dourados
- O índice navegável da dobra de recursos
- A dobra de perguntas
- O formulário da lista de espera (o código; falta a conexão)
- Sistema visual fechado: paleta, escala tipográfica, componentes de layout
- Sem estouro horizontal em 390, 768, 1440 e 1920, e sem erro de página

### Falta

Em ordem de importância, porque a primeira bloqueia todas as outras:

1. **O repositório não tem remoto.** `git remote -v` volta vazio. Tudo está só
   nesta máquina. Sem repositório e sem deploy, a lista de espera não recebe um
   e-mail sequer, e a página não existe para ninguém.
2. **A lista de espera não está ligada.** Falta criar as variáveis de ambiente
   e aplicar a migração no Supabase (seção 8).
3. **O modelo de cobrança não foi decidido.** Os três planos mostram "em
   breve" no lugar do preço. A estrutura está pronta para receber os números.
4. **Preços e Perguntas nunca passaram por uma revisão de efeitos.** Todas as
   outras dobras ganharam movimento próprio; essas duas continuam estáticas.
5. **Uma animação para depois da dobra da mesa.** Pedido do usuário, ainda não
   desenhado: "a ficha pode ficar ali, ela não precisa sair para continuar a
   animação, depois a gente pensa em uma animação para depois desse bloco".
6. **CSS morto** de uma versão anterior da mesa (seção 13).
7. O `README.md` ainda é o do `create-next-app`.

### Último commit

`1991677 A mesa para de se mexer: só as fichas animam, e o texto vem dos passos`

Branch `main`, árvore limpa.

---

## 4. A arquitetura, em uma página

O ponto que explica quase todo o resto: **a ficha 3D não pertence a nenhuma
seção.** Ela nasce no fim do herói e viaja até o rodapé, então quem a controla
precisa estar fora de todas as seções e enxergar o documento inteiro.

```
app/layout.tsx
├── <FundoRaios />         fixo, z-index 0, atrás de tudo
├── <RolagemSuave />       Lenis, sem render próprio
└── app/page.tsx
    ├── <Cena />           o maestro: mede a rolagem e comanda a cena 3D
    │   ├── <Ficha3D />    canvas fixo, z-index 5 (a ficha E a mesa)
    │   └── <AnelTexto />  div fixa, z-index 6
    ├── <HeroVideo />      dobra 1
    ├── <Promessa />       dobra 2
    ├── <AntesDepois />    dobra 3
    ├── <Mesa />           dobra 4 (só o texto e o contador; o 3D está na Cena)
    ├── <Recursos />       dobra 5
    ├── <Precos />         dobra 6
    ├── <Perguntas />      dobra 7
    ├── <Fechamento />     a lista de espera
    └── <Rodape />
```

As seções vivem em `z-index: 10`. O canvas 3D está em 5, ou seja, **abaixo do
conteúdo**. Isso é proposital: na dobra da mesa, o texto fica no meio do
feltro.

### O número que liga tudo: `progresso`

`Cena.tsx` calcula um número de 0 a 1: quanto da página, **depois do herói**,
já foi percorrido.

```
fim do herói = heroi.offsetTop + heroi.offsetHeight - innerHeight
percurso     = scrollHeight - innerHeight - fim
progresso    = (scrollY - fim) / percurso
```

Esse número é a régua de todo o percurso da ficha. Um segundo número, separado,
mede só a dobra da mesa e é publicado por `mesaSinal.ts`.

### Três coisas medem rolagem, e cada uma mede o seu

| Quem | Mede | Serve para |
|---|---|---|
| `useProgresso(ref)` em `useRolagem.ts` | um elemento qualquer | o vídeo do herói, a dobra da mesa |
| `Cena.tsx` | a página depois do herói | o percurso da ficha 3D |
| `mesaSinal.ts` | nada: é só um armazém | levar o progresso da dobra da mesa até a cena 3D, que vive fora dela |

`mesaSinal.ts` existe porque a seção `Mesa` sabe a própria geometria e mostra o
contador, enquanto a cena 3D desenha a mesa e as pilhas, e as duas estão em
lugares distantes da árvore. Calcular o progresso dos dois lados é o tipo de
coisa que casa no dia em que se escreve e desencontra no primeiro ajuste de
altura: o contador diria "3 de pé" com quatro pilhas ainda na mesa. Um número,
uma fonte. (Mesmo padrão, mesmo motivo, de um `abertura.ts` que existiu antes.)

---

## 5. As dobras, uma a uma

Nesta ordem em `app/page.tsx`. As frações da coluna "percurso" foram **medidas
na página montada em 1440x900** (ver seção 9 para o porquê de isso importar).

| # | Componente | id | Papel | Centro no percurso |
|---|---|---|---|---|
| 1 | `HeroVideo` | `heroi` | A promessa e a primeira porta para a lista | (antes de 0) |
| 2 | `Promessa` | `promessa` | O que o produto faz, em uma frase | 0,117 |
| 3 | `AntesDepois` | `como-funciona` | O argumento inteiro: hoje é assim | 0,233 |
| 4 | `Mesa` | `mesa` | A mesa 3D, com os três passos no feltro | 0,405 |
| 5 | `Recursos` | `recursos` | Tudo que o sistema faz, em detalhe | 0,602 |
| 6 | `Precos` | `precos` | A forma da oferta | 0,765 |
| 7 | `Perguntas` | `perguntas` | As objeções que travam a inscrição | 0,889 |
| 8 | `Fechamento` | `lista` | A lista de espera, e a pilha de fichas pousando | 0,993 |
| 9 | `Rodape` | | Marca e direitos | |

### 1. Herói (`HeroVideo.tsx`)

Seção de **260vh** com o conteúdo `sticky` dentro. Enquanto ela rola, o vídeo
fica parado na tela e o quadro avança.

Duas coisas fazem o raspar funcionar, e as duas são sobre o arquivo, não sobre
o código:

1. O vídeo foi reencodado com **quadro-chave em todo quadro** (`-g 1`). Vídeo
   normal tem um a cada dois segundos; para saltar para um instante qualquer o
   navegador teria que decodificar desde o anterior, e o raspar engasga. O
   arquivo passou de 2 quadros-chave para **192**, que é o total de quadros
   (8 segundos a 24 fps, 1280x720, 4,9 MB).
2. **Nada de `play()`.** O vídeo nunca toca: a rolagem escreve `currentTime`
   direto. Tocar e pausar brigaria com o dedo da pessoa.

A escrita do tempo acontece **fora** do evento de rolagem, num
`requestAnimationFrame`: buscar num vídeo é assíncrono, e pedir uma busca nova
antes de a anterior terminar faz o decodificador descartar trabalho e a imagem
tremer. Usa `fastSeek` quando existe. Diferenças menores que um quadro
(`1/48`) não valem uma busca.

O pôster (`maleta-poster.jpg`) segura a tela enquanto o arquivo baixa. Herói
que começa preto esperando 5 MB é pior que herói sem vídeo.

**O véu acompanha o texto.** Medido no primeiro quadro: atrás do subtítulo e
dos botões o fundo tem p90 de 135 e picos de 227, que são as fichas douradas da
maleta, exatamente onde o texto cai. Texto claro ali fica ilegível. Escurecer a
cena inteira o tempo todo resolveria a legibilidade e mataria o herói, porque a
graça é a ficha subindo com a luz batendo nela. Então o véu segue a opacidade
do texto: forte enquanto há o que ler, e some quando a ficha vira o assunto.

O texto some na primeira metade (`1 - p/0.42`) e sobe 90px.

**Abaixo de 768px ou com `prefers-reduced-motion`, não há vídeo:** o pôster
entra como imagem estática e a seção volta a ter a altura do conteúdo. Herói de
landing não vale 5 MB e um decodificador de vídeo no celular de alguém.

### 2. Promessa (`Promessa.tsx`)

Esta frase era o subtítulo do herói, e lá não tinha chance: o vídeo correndo, a
ficha subindo, e o texto saindo de cena na primeira metade da rolagem. Era a
frase que diz o que o produto **faz**, competindo com o momento em que a página
só tem um assunto. Sozinha, numa dobra própria, ela tem tempo de ser lida.

O surgimento é **por cláusula, não por letra**. Animar letra a letra fica
bonito num título de três palavras e vira gagueira numa frase de vinte. Cada
cláusula sobe inteira, com 130ms de atraso entre elas, e o `clip-path` faz o
texto emergir do próprio espaço em vez de aparecer por cima. Dispara num
`IntersectionObserver` com `rootMargin: '-15% 0px -20% 0px'`, e **uma vez só**:
reanimar a cada passada transforma um efeito de entrada num piscar toda vez que
a pessoa volta a rolar para cima.

O texto ocupa `lg:w-[62%]` e cede a direita para a ficha, que para exatamente
ali. É coluna reservada, não sobra: uma peça grande e parada ao lado do que se
lê vira parte da página; espremida num vão, vira enfeite de canto.

### 3. Antes e depois (`AntesDepois.tsx`)

Isto eram **duas** seções: "A dor" (cinco cenas de uma noite ruim) e "Como
funciona" (três passos). Dois títulos, dois blocos de respiro, duas molduras,
para sustentar **um** argumento: hoje é assim, com o app é assado. Separadas, a
virada acontecia num vão de 200px entre seções, que é o lugar onde ela não
acontece.

Hoje a dobra tem as cinco cenas em grade, mais um sexto cartão que é a
charneira: *"Nada disso é sobre pôquer. É sobre planilha."* Ela fecha a fileira
das cenas, e funciona por estar encostada nelas.

Os **três passos saíram daqui** e foram para o meio da mesa (dobra 4). Continuam
exportados deste arquivo como `PASSOS`, porque o conteúdo é daqui mesmo; o que
mudou foi onde ele aparece.

### 4. A mesa (`Mesa.tsx` + a cena 3D)

**O desenho da mesa não está em `Mesa.tsx`.** Ele vive em `Ficha3D.tsx`, na
mesma cena da ficha que atravessa a página. Isso não é organização, é o que
torna a coisa possível: a ficha precisa **pousar** numa pilha, e pousar de
verdade exige a mesma perspectiva, a mesma luz e o mesmo teste de
profundidade. Com a mesa num canvas à parte, o melhor que se consegue é
sobrepor uma imagem na outra e torcer para o ângulo bater.

`Mesa.tsx` tem a seção: a altura, o conteúdo grudado no meio da tela e o
contador. Ela publica o próprio progresso em `mesaSinal`.

A seção tem **170vh** de propósito. Ela precisa ser mais alta que a tela para
existir um percurso, e é ele que faz as pilhas sumirem conforme a pessoa rola,
em vez de um relógio correndo sozinho num canto da página. O conteúdo é
`sticky` e ocupa uma tela.

**Abaixo de 769px a cena 3D não roda**, então lá a dobra volta a ter a altura do
conteúdo (medido: 1004px em 390, 668px em 768). Se os 170vh valessem, seriam
1435px e 1741px de preto com um texto grudado no meio. A consulta de mídia é
`min-width: 769px` e não 768: `useTelaPequena` reprova em `max-width: 768px`,
então em 768 exatos a cena não roda.

Conteúdo sobre o feltro, nesta ordem: rótulo "Enquanto isso", título "Três
passos, e a noite **cuida de si**.", os três `PASSOS`, um painel que muda com a
rolagem (Nível / Blinds / De pé / Bolo) e a premiação, que só aparece quando
sobra um. Desfecho que está na tela desde o começo não lê como desfecho.

Os números não são inventados: **50/30/20** é o que `lib/payouts.ts` do
aplicativo aplica a um campo de 6 a 9 jogadores. Demonstração que inventa a
conta é pior que nenhuma demonstração. Os blinds sobem a cada duas quedas.

`quedasEm(progresso)` é **exportada** e usada dos dois lados: a seção para o
contador, a cena 3D para apagar as pilhas. A janela de eliminação vai de 0,16 a
0,78 do progresso da dobra, com folga nas duas pontas: entrando, para a mesa
chegar cheia; saindo, para o campeão ficar um tempo sozinho antes de a dobra ir
embora.

**Histórico desta dobra, porque ela foi refeita três vezes:**

- v1: um diagrama em SVG, mesa de frente, lugares em volta, cartas aparecendo
  e sumindo. Funcionava, mas era um diagrama: a ficha não podia pousar nele, só
  passar por cima ou por baixo. Rejeitada.
- v2: a mesa 3D, mas animada (crescia ao entrar) e com texto próprio.
  Rejeitada: *"queria a mesa fixa, a única coisa que vai ser animada vão ser as
  fichas. não gostei do resultado e do texto"* e *"não gostei do texto que você
  colocou dentro da mesa, pode colocar um dos outros blocos de texto"*.
- v3, a atual: mesa completamente estática, só as fichas animam, e o texto são
  os três passos.

### 5. Recursos (`Recursos.tsx` + `ListaLinhas.tsx`)

Isto eram quinze cartões parados, empilhados em quatro grades: a dobra mais
longa da página e a única em que nada acontecia enquanto se lia. Hoje é um
**índice à esquerda e o detalhe à direita**: quatro linhas para percorrer em vez
de quinze caixas para varrer, e a dobra encolheu para menos de metade da
altura.

Os quatro grupos não são categoria de catálogo, são as quatro coisas que uma
noite de home game tem: **A noite** (o relógio), **O dinheiro**, **A mesa**, **A
temporada**. Quem organiza reconhece as quatro antes de ler o que está embaixo.

A lista foi levantada lendo `lib/` e `stores/` do aplicativo, não de memória:
cada item corresponde a código que existe. O bloco "Ainda não, mas vem" no fim
tem as quatro que não existem, marcadas.

O `key` no grupo faz o React remontar o painel a cada troca, e é isso que
redispara a animação de entrada. Sem ele a troca seria um corte seco e o olho
perderia que o conteúdo mudou.

### 6. Preços (`Precos.tsx`)

**Os valores são marcador de lugar.** O modelo de cobrança ainda não foi
decidido, e inventar preço numa página de vendas ancora a percepção de valor
antes de existir decisão; mudar depois parece que a empresa não sabe o que faz.

Enquanto o preço não está fechado, o lugar dele não pode ficar com um número de
mentira nem com a fonte de "R$ 49" esticando um texto qualquer: some o corpo
grande e fica só "em breve" em rótulo.

Três colunas, a do meio destacada, e o texto de cada plano dizendo **para quem**
ele é, não quantos recursos tem.

### 7. Perguntas (`Perguntas.tsx`)

Sem preço fechado e sem prova, o que segura alguém de deixar o e-mail não é
falta de entusiasmo, é dúvida concreta. Quatro perguntas, todas com resposta
honesta hoje: tem Android, todo mundo precisa instalar, quando abre, onde ficam
os dados.

`<details>`/`<summary>` nativo: abre e fecha sem uma linha de JavaScript,
funciona antes de a página hidratar, e já vem com o papel certo para o leitor de
tela. Um acordeão feito à mão aqui seria trabalho para chegar atrás do que o
navegador já faz.

### 8. Fechamento (`Rodape.tsx` + `ListaEspera.tsx`)

O destino de todos os botões da página. Fica aqui, e não numa dobra própria,
porque é também onde a pilha de fichas 3D pousa: o pagamento visual da página
acontece junto com o pedido.

---

## 6. A cena 3D (`Ficha3D.tsx`, 778 linhas)

O arquivo mais importante e o mais delicado. Uma cena, uma câmera, um
`requestAnimationFrame`, e dentro dela: a ficha viajante, as três pilhas do
fecho e a mesa de pôquer inteira.

### A emenda com o vídeo

O único momento que não perdoa erro é o primeiro. Se a ficha 3D nascer com
tamanho, posição ou cor diferentes do último quadro do vídeo, a troca aparece,
e não tem como disfarçar depois. Por isso **nada aqui foi ajustado no olho**.

**Tamanho e posição saem de equação.** O disco foi medido no quadro final:
centro em (950, 540) e raio 351 num quadro de referência de 1920x1080, ou seja
64% da altura. A distância da câmera vem de:

```
distância = raio / (ocupação · tan(fov/2))       // FOV 30°, raio 1
```

> O arquivo de vídeo é 1280x720, mas as constantes `VIDEO_W`/`VIDEO_H` são
> 1920/1080. **Não é bug.** Toda a calibração é em frações do quadro, e a
> proporção é a mesma; a medição foi feita num quadro de referência em
> 1920x1080. Trocar os números para 1280/720 dá exatamente o mesmo resultado.

**A ficha do vídeo não está no centro do quadro.** O disco foi medido em x=950
num quadro de 1920, ou seja 10px à esquerda do meio. Dez pixels parecem nada
até a ficha 3D nascer centrada em cima dela: a medição do quadro da emenda
acusou 8px de descasamento, e 8px de salto lateral no instante da troca é
exatamente o que o olho pega sem saber dizer o que viu. Daí o `DESLOCAMENTO_X`,
guardado como fração da altura do quadro e convertido na hora de desenhar (a
conversão depende da câmera, que muda com a proporção da janela).

**`object-fit: cover` muda a conta.** Os 64% valem numa janela 16:9. Numa janela
mais larga que isso, o `cover` encaixa pela largura, o quadro cresce inteiro, e
a ficha do vídeo passa dos 64%. Sem `ocupacaoNaJanela()` a emenda fecharia em
1440x900 e se abriria sozinha num ultrawide, que é justamente onde ninguém
testa.

**A cor é o próprio quadro.** A face da ficha é `public/ficha-face.jpg`, um
recorte de 1024x1024 do último frame do vídeo, e não um redesenho: iluminação,
textura de couro e granulado de compressão estão assados no pixel, e reproduzir
isso desenhando chega perto e erra.

Disso vem a consequência mais importante do arquivo: **a luz da cena quase não
toca a face.** Se a face já vem com o claro e o escuro do vídeo dentro dela,
iluminá-la de novo multiplicaria a sombra duas vezes e o tom fugiria na hora da
troca. Então:

```ts
new THREE.MeshStandardMaterial({
  map: face,
  emissive: 0xffffff,
  emissiveMap: face,
  emissiveIntensity: 0.79,   // ver abaixo
  roughness: 0.9,
  metalness: 0,
  color: 0x000000,           // preto para o difuso: a luz não pinta a face
})
```

Os 0,79 não são gosto. O herói tem um véu escuro que cai em cima do vídeo, e a
textura foi recortada **com o véu desligado**. Medido no quadro da emenda: o
vídeo exibido fica 10% mais escuro que o arquivo. Sem essa conta a ficha 3D
nasceria clara demais em cima dele. O `color` quase preto deixa uma fresta para
a luz, só o bastante para a face escurecer quando a ficha vira de costas.

Resultado da calibração de cor: a distância média de cor entre a ficha do vídeo
e a 3D caiu de **58,6 para 17,9** (em 255).

O bisel é um toro cujo raio mais o tubo fecham **exatamente** no raio do corpo.
Um fio a mais e ele aparece como duas orelhas claras saindo da silhueta quando
a ficha gira de perfil. A cor (`0x8a7358`) saiu do anel externo da própria face
do vídeo: no raio 0,88 o decil mais claro é (163,125,81). Bisel cinza fazia a
silhueta sumir no fundo e a ficha 3D parecer menor que a do vídeo.

### A troca de placa (a "piscada")

Este ponto foi refeito quatro vezes. O comportamento atual é o aprovado, e
qualquer mexida aqui precisa entender por quê.

O último quadro do vídeo tem a ficha dentro dele. Quando a ficha 3D assume, a
do vídeo continuaria ali, parada no centro: duas fichas na tela. Por isso existe
`maleta-vazia.jpg`, a mesma cena sem a peça.

- A imagem entra em **corte seco** (`opacity: p >= 1 ? 1 : 0`), não em
  dissolvida. Dissolvendo, a ficha do vídeo some aos poucos: fica um fantasma
  dela no centro enquanto a ficha 3D já saiu andando, e o que se lê não é "a
  peça saiu da maleta", é "apareceu uma cópia e a original apagou". Foi
  exatamente esta a reclamação do usuário: *"a imagem está meio que sumindo aos
  poucos, aí está ficando um resíduo da ficha para trás"*.
- A ficha 3D **aparece instantânea** e some com calma
  (`transition: visivel ? 'none' : 'opacity 300ms'`). Se ela entrasse
  suavizada, o corte da placa aconteceria com a ficha ainda translúcida, e por
  baixo dela estaria a maleta já vazia. A entrada não tem o que suavizar: a
  ficha nasce no lugar, no tamanho e na cor da que está no vídeo.
- O resto do quadro (maleta, brilho) foi casado por medição: ganho e offset por
  canal ajustados contra o quadro final, fora do disco da ficha. Distância média
  resultante: **2,47 em 255**.
- `ANTECIPACAO = 4` (pixels): a ficha 3D acende um pouquinho **antes** do fim do
  herói. Quem acende a ficha é o ouvinte de rolagem da `Cena`; quem corta para
  a maleta vazia é o do `HeroVideo`. São dois ouvintes diferentes, e nada
  garante que caiam no mesmo quadro. Se a placa cortasse primeiro, haveria um
  quadro com a maleta vazia e sem ficha nenhuma, que é uma piscada de verdade.
  Eram 12px, mas nesse trecho o vídeo ainda não chegou ao último quadro e a
  ficha dele ainda cresce; 4px é folga suficiente para a ordem e curto o
  bastante para o tamanho não divergir.

Medido: o salto de brilho médio entre quadros na troca caiu de **+3,91 para
+0,42**.

> Houve uma tentativa de resolver isso escurecendo a ficha permanentemente. O
> usuário rejeitou: *"volta para a piscada do jeito que estava antes, tava
> melhor"*. O problema nunca foi o brilho, era o fantasma.

### O percurso: `MARCOS`

Cada marco é uma pose (`x, y, z, escala, giroX, giroY, giroZ`) numa fração do
percurso, e o que roda entre eles é interpolação com suavização nas pontas
(`t·t·(3-2t)`). Interpolação linear faz a ficha "bater" ao chegar em cada
marco, e o olho lê isso como falha, não como escolha.

| Fração | Onde | Pose |
|---|---|---|
| 0,00 | a emenda | centrada, de frente, escala 1 |
| 0,05 | começa a 1ª pausa | `POSE_PAUSA.pose` |
| 0,19 | acaba a 1ª pausa | a **mesma** pose |
| 0,27 | antes e depois | recua à direita, encolhendo, começa a virar |
| 0,40 | começa a 2ª pausa | escala da mesa, deitada no feltro |
| 0,485 | acaba a 2ª pausa | a **mesma** pose |
| 0,63 | recursos | desce para o vazio da coluna esquerda |
| 0,78 | preços | volta à direita, quase de perfil |
| 0,90 | perguntas | desce deitando, já na inclinação da pilha |
| 1,00 | a lista | pousa como a ficha de cima da pilha do meio |

Duas regras que os valores respeitam:

- **A ficha nunca encosta na borda.** Ficha cortada pela lateral não lê como
  movimento, lê como erro de posicionamento.
- **`giroY` é monotônico** e termina em voltas fechadas (`2π`, `4π`). Parar no
  meio de uma volta deixa a peça de cima da pilha com orientação própria, e
  pilha com a ficha de cima torta não lê como pilha.

As pausas são **dois marcos com a pose idêntica**: entre eles a interpolação não
tem o que interpolar, e a ficha fica parada de verdade, inclusive a rotação, que
é o que costuma denunciar uma pausa falsa.

### As duas pausas

**`POSE_PAUSA` (0,05 a 0,19), na dobra da Promessa.** É exportada porque o anel
de texto precisa saber exatamente onde a ficha está na tela para girar em volta
dela; duas fontes de verdade para a mesma posição desencontrariam no primeiro
ajuste.

A janela é mais larga que a dobra de propósito: a dobra ocupa 0,105 a 0,129 e
tem centro em 0,117, mas a pausa começa em 0,05, quando a ficha mal saiu da
maleta, para o anel já estar girando quando a frase entra em quadro. O usuário
pediu: *"o efeito do texto tem que começar um pouco antes"*.

`x = 1.389` e `escala = 0.62` saem da largura que a dobra cede: o texto ocupa
62% da coluna (144 a 858 em 1440px) e a ficha fica no que sobra. Com essa
escala o anel mede ~490px e cai entre 874 e 1366, ou seja 16px do texto e 74px
da borda. Anel que encosta no texto deixa de ser objeto e vira acidente.

`y = 0.30` sobe a peça. Em -0,05 ela ficava no meio da tela, e como o anel é
fixo na viewport enquanto o texto rola, havia um trecho em que a ficha aparecia
abaixo da frase, já invadindo a dobra seguinte. O usuário pediu: *"a ficha tem
que ficar mais para cima"*.

**`PAUSA_MESA` (0,40 a 0,485), em cima da mesa.** A escala é
`RAIO * 0.1 * MESA_RAIO`, que é **exatamente** o tamanho das fichas da mesa: a
pilha não pode ficar com uma peça de outro jogo em cima. A ficha entra na
página com escala 1, e a viagem inteira é essa diminuição. O `giroX` é
`MESA_TOMBO - π/2`, que é o quanto ela precisa girar para ficar plana sobre o
feltro.

Dentro dessa janela, a posição da ficha não vem da pose: ela **mira o topo da
pilha vencedora**, medido no mundo com `localToWorld`:

```ts
const forcaMesa = faixa(p, PAUSA_MESA.de - 0.08, PAUSA_MESA.de)
                * (1 - faixa(p, PAUSA_MESA.ate, PAUSA_MESA.ate + 0.06));
if (forcaMesa > 0) {
  alvoX += (topoDaPilha.x - alvoX) * forcaMesa;   // idem Y e Z
}
```

A pilha é neta de um grupo com rotação e escala, e refazer essa conta à mão é
onde se erra por meio centímetro, que na tela vira a ficha flutuando ao lado da
pilha em vez de em cima dela. A mistura nas bordas existe para ela **chegar** à
mesa, em vez de saltar para lá.

### A mesa, em números

| Constante | Valor | Por quê |
|---|---|---|
| `MESA_TOMBO` | 1,05 rad (60°) | Em 0 o tampo fica de canto (uma linha); em π/2 vira um círculo chapado. 60° deixa a elipse achatada o suficiente para ler "vista de cima" e ainda sobrar profundidade entre a borda de cima e a de baixo. |
| `MESA_RAIO` | 1,78 | No plano z=0 a cena mede 3,12 de altura e ~5,0 de largura em 16:10. Com esse raio o tampo mede 5,7 de largura, passando das bordas (o "de ponta a ponta" pedido). |
| `MESA_OVAL` | 1,6 | Depois do tombo, 3,08 de altura: cabe na vertical com folga fina, que é o que mantém o aro visível em cima e embaixo. Aro que sai de quadro deixa de ser mesa e vira fundo verde. |
| `MESA_ANEL` | 0,7 | Onde as pilhas ficam, em fração do raio: dentro do aro, na beirada do feltro. |
| `MESA_FICHAS_POR_PILHA` | 9 | |
| `LUGARES` | 8 | Em `Mesa.tsx` |

Peças: feltro (cilindro, verde 0x16351f, `roughness` 0,97 porque feltro não tem
brilho e um verde com reflexo vira plástico na hora), estofado (toro escuro) e o
fio de ouro que separa os dois, que é o que amarra a mesa à marca.

**A mesa é fixa.** `mesa.scale.setScalar(MESA_RAIO)` acontece uma vez, na
construção. A rolagem só controla `opacity`, e só em **três materiais
próprios** guardados em `materiaisMesa`. As fichas usam os materiais
compartilhados com a ficha viajante: mexer na opacidade deles apagaria a peça
que atravessa a página inteira.

**Só as pilhas animam.** Cada uma persegue um alvo (1 ou 0) com suavização por
segundo, encolhe e afunda no feltro ao sair, em vez de piscar:

```ts
const alvoVivo = i === 0 || i > caidos ? 1 : 0;   // a pilha 0 é a do campeão
vivas[i] += (alvoVivo - vivas[i]) * Math.min(1, dt * 7);
pilha.scale.setScalar(vivas[i]);
pilha.position.y = 0.018 - (1 - vivas[i]) * 0.06;
```

### As três pilhas do fecho

Alturas desiguais de propósito (7, 13 e 9 fichas): três pilhas iguais lado a
lado lê como gráfico de barras, não como dinheiro em cima da mesa. A ficha
viajante pousa na do meio, a mais alta, e o ponto de pouso é **calculado**
aplicando a mesma rotação e a mesma escala que o grupo aplica nos filhos.
Chutar esse ponto faria a ficha pousar *perto* da pilha, e "perto" é exatamente
o que se enxerga.

Dentro de cada pilha, as fichas usam **ângulo áureo** (2,39996 rad) e um
desencontro de 0,035 em x e y. Pilha de verdade nunca fica com as bordas
casadas, e casadas é justamente o que faz um render parecer render.

Elas só entram a partir de 0,90. Antes disso seriam objetos parados num canto,
sem explicação, disputando atenção com o texto que está sendo lido.

### A parte interativa

O ponteiro inclina a ficha (`TILT_MAX = 0.20` rad) e a rolagem rápida a faz
girar mais (`GIRO_POR_ROLAGEM = 7.0`, com `ATRITO = 2.4` por segundo). O giro
extra é um **empurrão**, não uma posição: some sozinho quando a pessoa para, sem
precisar de ninguém para desfazê-lo.

Os dois efeitos valem **zero nas duas pontas**: no começo porque a emenda é
exata, e no fim porque a ficha tem que pousar alinhada com a pilha. A licença é
`faixa(p, 0.02, 0.14) * (1 - faixa(p, 0.84, 0.97))`.

A ficha **persegue** o ponteiro em vez de colar nele: colar transforma cada
tremida da mão em tremida da ficha.

### Regra geral da cena

**Tudo que é físico anda por segundo, não por quadro.** Num monitor de 120Hz um
efeito por quadro corre com o dobro da velocidade. Daí o `dt` em toda
suavização, limitado a 0,05 para a página não dar um salto ao voltar de uma aba
em segundo plano.

Geometrias e materiais nascem **uma** vez e são compartilhados. A cena tem mais
de cem fichas somando o fecho e a mesa; cem cópias de uma textura de 1024px
seriam cem envios para a placa desenhando a mesma coisa.

---

## 7. O sistema visual

Tudo mora em `app/globals.css`, num `@theme` do Tailwind 4. **Não existe
`tailwind.config.js`.**

### Cores: preto e ouro, e nada de marrom

Pedido do usuário: *"quanto a cores no sistema como um todo, estou sentindo
muito voltado para o marrom, o foco é apenas no dourado e preto"*.

Medido antes de mexer: `text0` tinha **51,2% de saturação**, praticamente a
mesma do ouro da logo (46,8%). Ou seja, o texto do site inteiro era um creme,
não um branco, e como texto é o que cobre mais área de uma página, era ele que
pintava tudo de marrom. Os fundos vinham no mesmo caminho: 17,6% no `bg0`.

Hoje os fundos são neutros de verdade e os textos guardam só 4% de calor, o
suficiente para não virarem azulados ao lado do ouro. **A luminosidade de cada
um é exatamente a de antes**, então nenhuma relação de contraste mudou: o que
saiu foi a cor, não o peso. A escala de ouro ficou intocada, e passou a ser a
única fonte de cor da interface.

```
bg0 #080808   bg1 #101010   bg2 #181818   bg3 #222222
text0 #ebebea  text1 #bab8b5  text2 #837f7a  text3 #474542
gold50 #f3e5cd … gold400 #c49c5c (o ouro da logo) … gold800 #1e1910
ok #78a885   danger #c85a5a
line rgba(255,255,255,.07)   lineStrong rgba(255,255,255,.14)
```

`text2` foi clareado de `#74716c` para `#837f7a`, e não foi por gosto: ele
carrega o texto corrido e tinha **4,12:1** sobre o preto, abaixo dos 4,5:1 que a
norma pede. Já estava reprovado antes do fundo de raios; o fundo só tornou isso
visível, ao levar a superfície onde se lê de (8,8,8) para (22,21,19) e o
contraste para 3,68:1. O valor atual é o **menor** clareamento que passa:
4,50:1 com o fundo ligado, 5,04:1 no preto puro.

### Tipografia

Três famílias, três papéis:

- **Sora** (peso 800) nos títulos
- **Inter Tight** na interface e no texto corrido
- **DM Mono** nos algarismos

A Sora passou por duas trocas. **Cormorant Garamond** era uma garalda desenhada
para corpo de texto em livro: em título de 4rem sobre preto ela sumia, o traço
não tinha peso. **Playfair Display** resolvia o peso mas continuava serifada, e
o usuário foi direto: *"muda a fonte e não use fontes serifadas"*. A Sora é
geométrica, fecha em 800 com haste realmente grossa, e tem personalidade
própria o bastante para não se confundir com a Inter Tight. Em preto e ouro ela
funciona porque a massa cheia da letra é o que devolve o brilho do ouro; letra
fina deixa o dourado virar um fio.

A entreletra negativa nos títulos não é enfeite: letra grossa em corpo grande
cria vãos largos entre as palavras se o tracking ficar no padrão, e o título
desmancha.

### A escala: oito degraus, e nenhum tamanho fora deles

Antes desta seção a página tinha **dezesseis** tamanhos avulsos escritos um a um
no meio das classes: 0,72 / 0,85 / 0,92 / 0,93 / 0,95 / 0,98 / 1,05 / 1,15 /
1,4 / 1,45 / 1,6 / 1,7. Nenhum estava errado sozinho. O problema é que 0,92 e
0,95 lado a lado não leem como dois níveis de importância, leem como descuido, e
é isso que faz uma página parecer amadora antes de alguém ler uma palavra.

A razão entre degraus vizinhos é ~1,22.

```
.t-hero       clamp(2.5rem, 6.2vw, 4.8rem)     fluido
.t-secao      clamp(2rem, 4.2vw, 3.05rem)      fluido
.t-sub        1.55rem
.t-card       1.28rem
.t-corpo      1.0625rem
.t-apoio      0.9375rem
.t-micro      0.8125rem
.t-ornamento  clamp(2.6rem, 4.4vw, 3.4rem)     marco visual, não texto
```

Os dois maiores são fluidos porque título grande que não encolhe quebra em
celular; os menores são fixos porque corpo de texto que muda de tamanho com a
janela atrapalha a leitura.

`.medida { max-width: 60ch }` em todo parágrafo solto: a coluna tem 1152px, o
que daria mais de 110 caracteres por linha, e o confortável é 45 a 75.

### O fundo (`FundoRaios.tsx`)

Raios de luz dourada que derivam de lado e respiram, muito devagar. Adaptado de
um componente em gradiente escuro, com quatro mudanças, e nenhuma é gosto:

1. **A cor.** O original é ciano. Os raios são o ouro da marca, e são a única
   cor da página.
2. **A textura.** O original puxa um PNG de ruído de um CDN de terceiro. Um
   fundo que só aparece se um servidor alheio responder não é um fundo, é uma
   dependência. Aqui é `feTurbulence` embutido em data URI.
3. **A animação.** O original é estático, apesar do nome. Cada camada tem
   período diferente para nunca casarem o ciclo: padrão que repete visivelmente
   lê como papel de parede, não como luz.
4. **Só `transform` e `opacity` animam.** Animar `mask-position` daria o mesmo
   efeito e obrigaria o navegador a repintar cinco camadas em tela cheia a cada
   quadro. Isto divide tela com um vídeo raspado e uma cena 3D.

A máscara horizontal é o que permite os raios serem fortes: eles quase somem na
metade esquerda, onde o texto mora, e chegam inteiros na direita, que é espaço
livre. A primeira tentativa foi baixar a intensidade no quadro todo, e aí o
efeito sumiu junto, que foi exatamente a reclamação.

O gradiente da base começa em `bg1` e não em `bg3`: ele é fixo na viewport e
clareia no canto superior esquerdo, que é exatamente onde o rótulo e o título de
**toda** seção caem. Medido: o fundo atrás do título ficava em (50,46,40), seis
vezes mais claro que o preto do site, e o texto de apoio despencava para 2,5:1
ali.

Medição da paleta com e sem o fundo, isolada na **mesma** dobra: 2,0% contra
5,2% de saturação média.

---

## 8. A lista de espera

Quatro arquivos, e o fluxo é curto de propósito.

```
components/ListaEspera.tsx   um campo, um botão, três estados
app/api/lista/route.ts       POST, valida e insere
lib/supabase.ts              cliente, só no servidor
supabase/migrations/0001_lista_espera.sql
```

Decisões que não são óbvias:

- **E-mail repetido é sucesso.** Quem se inscreveu há um mês e esqueceu não
  precisa descobrir isso na forma de um erro vermelho. O banco tem `unique` no
  e-mail, a segunda tentativa volta com o código **23505**, e é isso que a rota
  traduz para "pronto".
- **A mensagem de erro não conta o que aconteceu.** Se o Supabase estiver fora,
  quem visita não tem o que fazer com esse detalhe, e a mensagem técnica só
  serve para quem estiver sondando a rota. O detalhe vai para o log.
- **`import 'server-only'` em `lib/supabase.ts`** é uma armadilha proposital:
  qualquer componente de cliente que tentar importar esse arquivo quebra o
  build, em vez de mandar a conexão para o navegador.
- **A chave é a anônima, não a de serviço.** A tabela tem RLS com **uma única
  policy, de INSERT, e nenhuma de SELECT**: quem visita entra na lista e não
  pode lê-la. Usar a chave de serviço daria poder de leitura a uma rota que só
  precisa escrever, e o dia em que essa rota tivesse um bug ela vazaria a lista
  inteira.
- A confirmação aparece **no lugar** do formulário, não abaixo dele: um campo
  vazio ao lado de "pronto" convida a mandar de novo.

### O que falta para ela funcionar

1. Criar `.env.local` com `SUPABASE_URL` e `SUPABASE_ANON_KEY` (e as mesmas
   variáveis na Vercel, quando houver deploy).
2. Colar `supabase/migrations/0001_lista_espera.sql` no editor SQL do Supabase.
   **Migração commitada não é migração aplicada**, e aqui não há CLI ligada.

O projeto Supabase do King's Table já existe: ref `hjxjxhnpcukwimiksbbz`,
região São Paulo, numa conta separada criada só para este produto. Dá para usar
o mesmo projeto do aplicativo ou criar outro. As credenciais **não estão neste
repositório e não devem entrar nele**: elas estão na memória do projeto, em
`~/.claude/projects/-Users-winistonalle/memory/project_kings_table.md`, e o
`.gitignore` já ignora `.env*`.

### Verificação, quando estiver ligada

1. Enviar um e-mail e conferir a linha no Supabase.
2. Enviar o **mesmo** e confirmar que a tela agradece em vez de dar erro.
3. Enviar um inválido e conferir a mensagem.
4. Tentar `select * from lista_espera` com a **chave anônima** e confirmar que
   volta vazio. Se quem visita puder ler, a dobra virou um vazamento de e-mails.

---

## 9. Mexer na estrutura obriga a remedir

Esta é a manutenção mais fácil de esquecer e a que mais estraga a página.

As frações em `MARCOS`, `POSE_PAUSA` e `PAUSA_MESA` **não são escolhidas no
olho**: são o centro de cada dobra, medido na página montada. Mudar a altura de
qualquer seção, acrescentar ou remover uma dobra, mexer no tamanho de um
título: qualquer disso move todas as frações seguintes, e a ficha passa a parar
**entre** duas seções, que é onde ninguém está olhando.

Medição atual, feita em **1440x900** com a página em produção:

```
altura da página   9338 px
fim do herói       1440 px
percurso da ficha  6998 px
```

| Seção | topo | altura | centro no percurso |
|---|---:|---:|---:|
| heroi | 0 | 2340 | (antes) |
| promessa | 2340 | 734 | 0,117 |
| como-funciona | 3074 | 888 | 0,233 |
| mesa | 3962 | 1530 | 0,405 |
| recursos | 5492 | 1225 | 0,602 |
| precos | 6718 | 1046 | 0,765 |
| perguntas | 7763 | 696 | 0,889 |
| lista | 8459 | 756 | 0,993 |

Comparando com os `MARCOS` de hoje: as pausas e os marcos finais estão no
lugar. O marco de 0,27 (antes e depois) está **0,037 adiantado** em relação ao
centro real da dobra, 0,233. Não é grave, porque ali a ficha está de passagem e
não em pausa, mas se alguém mexer nessa dobra vale corrigir junto.

O script que produz essa tabela é `scripts/dobras.js` (seção 11).

---

## 10. Acessibilidade e degradação

Foi levado a sério desde o começo, e três coisas dependem disso:

**`prefers-reduced-motion`.** Desliga o vídeo (entra o pôster), desliga a cena
3D inteira, desliga o Lenis (volta a rolagem nativa: rolagem com inércia é
exatamente o tipo de coisa que essa preferência existe para desligar) e zera
todas as animações e transições no CSS.

**Abaixo de 768px** a cena 3D não roda e o vídeo vira imagem. Medido: em 390 e
768 a página não tem canvas nenhum. As dobras que dependiam do 3D (a mesa)
voltam à altura do conteúdo.

**O que é decorativo está marcado.** O canvas, o anel de texto, o fundo, o
vídeo e os SVGs da marca são todos `aria-hidden`. O índice de recursos usa
`<button>` de verdade com `aria-pressed`, e não `<li onClick>`: quem navega por
teclado não alcançaria um item de lista, e o leitor de tela não anunciaria que
aquilo é acionável. A proximidade do ponteiro nesse índice **nem chega a ser
registrada** em `pointer: coarse`: no toque não existe cursor pairando, e o
efeito só dispararia quando a pessoa já decidiu clicar.

---

## 11. Como testar

Não há suíte automatizada. O que existe é um conjunto de scripts de **medição**
em Puppeteer, em `scripts/`, com um `LEIAME.md` próprio explicando cada um.
Eles viviam num diretório temporário de sessão e foram copiados para cá
justamente para sobreviverem a esta passagem.

Os que valem mais:

| Script | O que faz |
|---|---|
| `larguras.js` | Estouro horizontal, contagem de canvas e erros de página em 390, 768, 1440 e 1920 |
| `dobras.js` | A tabela de frações da seção 9 |
| `mesa3d.js` | Captura a dobra da mesa em várias posições de rolagem e mede o feltro |
| `piscada.js` | Brilho médio quadro a quadro na troca vídeo → 3D |
| `pousa.js` / `pouso.js` | Onde a ficha pousa em relação à pilha |
| `tour.js` | Uma captura por dobra |

Eles usam o Puppeteer instalado no **projeto do portfólio**
(`~/Desktop/projetos/pessoal/portfolio/node_modules/puppeteer-core`) e o Chrome
do sistema, com SwiftShader para o WebGL rodar sem GPU:

```js
args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']
```

**Todos apontam para `http://localhost:3210`.** Suba com
`npx next start -p 3210` depois de buildar.

### O método que vale a pena manter

Quase toda decisão desta página foi tomada **medindo, antes e depois**, e não no
olho: distância de cor entre a ficha e o vídeo, salto de brilho na troca,
saturação média da página, relação de contraste por dobra, proporção da mesa
contra a razão das distâncias de câmera, posição real da rolagem. Quando o
usuário diz que alguma coisa está estranha, o caminho que funcionou foi sempre
medir o que ele está vendo antes de mexer.

---

## 12. Armadilhas

Cada uma destas custou tempo aqui.

**O Lenis intercepta `window.scrollTo`.** Um script de teste que chama
`scrollTo` e tira print **não está na posição que pediu**. O sintoma é uma série
de leituras não monotônicas que parecem bug na página e são bug no teste. A
correção: um laço que confirma o `scrollY` real com tolerância de 8px antes de
capturar.

**Rebuildar sem reiniciar o `next start` quebra a página.** Um chunk de JS passa
a responder 500 e a tela fica em branco. Aconteceu e o usuário viu. O hábito:
`rm -rf .next`, buildar, **reiniciar o servidor**, e só então abrir o link.

**Girar em Y depois de tombar em X não gira a peça no próprio eixo, faz ela
cambalhotar.** A primeira versão das pilhas da mesa empilhava fichas "de frente"
e depois tombava cada uma: a pilha inteira virava uma bola de fichas fanadas. A
correção é `criarFicha(deitada)`, que constrói a peça já na orientação certa.

**Escala não-uniforme em grupo que contém objetos de proporção fixa.** O oval da
mesa começou como `mesa.scale.x`, e tudo dentro herdava a deformação, inclusive
a espessura das fichas, que saíam esmagadas enquanto a ficha viajante chegava
com a proporção certa. Hoje a escala do grupo é uniforme e o oval está nas
peças que são ovais (`feltro.scale.x`, etc.), com as pilhas desfazendo o oval em
si mesmas.

**Máscara de pai multiplica com a do filho.** Os raios do fundo ficaram
invisíveis porque estavam dentro da camada base, herdando uma máscara radial que
apaga justamente o lado direito da tela, que é onde eles precisam ser fortes. O
grupo de raios hoje é **irmão** da base, não filho.

**Duas rolagens suaves brigam.** Nada de `scroll-behavior: smooth` no CSS: o
Lenis já faz isso, e as duas ativas ao mesmo tempo animam para destinos
diferentes. O sintoma é a página tremer ao clicar num link de âncora. Pelo
mesmo motivo, os links de âncora passam pelo `lenis.scrollTo` num ouvinte de
clique, e não por `scrollIntoView`.

**`overflow-x: clip` vai no `html` e no `body`.** Só no body, o valor propaga
para a viewport e o body para de cortar.

**`100vw` inclui a barra de rolagem; `clientWidth` não.** No macOS a barra é
sobreposta e a diferença é zero, então o bug só aparece no Windows e no Linux.
Isso já quebrou o projeto do portfólio deste mesmo usuário. Se for preciso
largura de viewport aqui, use uma variável medida, não `100vw`.

**Comentário JSX.** Quebrei o build três vezes escrevendo `*/` sem fechar o `}`,
e uma vez pondo um comentário logo depois de `return (`.

**Editar um valor que já não está no arquivo falha em silêncio.** Duas
tentativas de corrigir o `@keyframes` do fundo não fizeram nada porque
procuravam por valores antigos. Depois de editar CSS animado, conferir a
opacidade **computada**, não o texto do arquivo.

---

## 13. Dívidas e limpezas conhecidas

**CSS morto**, em `app/globals.css`, aproximadamente das linhas 514 a 632:
`.mesa`, `.mesa__carta`, `.mesa__lugar--*`, `.mesa__posicao`, `.mesa__anel`,
`.mesa__rotulo`, `.mesa__bolo*`, `.mesa__premio*` e o bloco de
`prefers-reduced-motion` que os acompanha. É tudo da v1 da mesa, aquela em SVG.
`grep -rn "mesa__" components/` volta vazio. `.mesa-dobra` e `.mesa-grude`, que
vêm logo depois, **estão em uso**: não apague junto.

**`.mesa-premios`** é usada em `Mesa.tsx` mas não existe no CSS. O bloco da
premiação aparece por `style={{ opacity }}` sem transição, ou seja, em corte
seco. Provavelmente deveria ter uma transição de opacidade.

**Comentário desatualizado** em `Secao.tsx`: o `Titulo` diz "O destaque em
serifa itálica marca uma expressão", mas o `Realce` é `not-italic` e a fonte
não é serifada desde a troca por Sora.

**`README.md`** ainda é o do `create-next-app`.

**`next.config.ts`** está vazio.

---

## 14. Como o usuário trabalha

Coisas que valem mais que preferência de estilo aqui:

- **Nunca use travessão (o caractere "—") em texto escrito para ele**, nem em
  copy da interface. Ele acha que parece texto de IA. Vírgula, dois pontos ou
  parênteses resolvem.
- **Commitar sempre**, a cada mudança concluída que passa no build, sem
  perguntar. Não acumular trabalho fora de commit. (Aqui não há push porque não
  há remoto.)
- Ele avalia pelo resultado na tela, não pela descrição. Mandar o link de um
  servidor **reiniciado depois do build** vale mais que um parágrafo.
- Quando ele rejeita alguma coisa, costuma dizer o que sentiu, não a causa. O
  caminho que funcionou foi traduzir a sensação em medida antes de mexer.
  Exemplo: "está piscando" era, na verdade, o fantasma da ficha numa
  dissolvida.
- As mensagens dele vêm em português, sem acentuação rigorosa e às vezes com
  letras trocadas. Nada disso muda o pedido.
- Os comentários deste código são longos e explicam **o porquê**, não o quê. Foi
  pedido implicitamente e mantido desde o primeiro commit; vale manter o tom.

---

## 15. Próximo passo sugerido

Na ordem em que eu retomaria:

1. **Criar o repositório remoto e ligar na Vercel.** Enquanto não existir, nada
   do resto chega a alguém, e a lista de espera é decorativa.
2. **Ligar a lista de espera** (seção 8) e rodar a verificação de quatro passos,
   principalmente a quarta.
3. **Confirmar a dobra da mesa com o usuário.** Ela foi rejeitada duas vezes; a
   versão atual atende aos dois pedidos, mas ele ainda não viu com os próprios
   olhos.
4. **Desenhar a animação de depois da mesa**, que ele pediu e ficou pendente.
5. **Efeitos em Preços e Perguntas**, as duas dobras que nunca tiveram um passe.
6. **Limpar o CSS morto** e as dívidas da seção 13.
7. Preço, quando houver decisão.
