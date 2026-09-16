# Unificar app e landing num monorepo

Desenho aprovado em 16/09/2026. Cobre a **primeira etapa** da unificação:
os dois projetos passam a viver num repositório só, compartilhando
ferramental, sem que nenhum dos dois pare de buildar.

## Por que

Hoje existem duas pastas irmãs em `~/Desktop/projetos/pessoal`, cada uma com
seu `.git`:

| | `kings-table-app` | `kings-table-site` |
|---|---|---|
| O que é | App de poker (Expo/React Native) | Landing page |
| Remoto | `github.com/WinistonAlle/kings-table-app` | nenhum |
| Tamanho | 407 MB | 675 MB |

O pedido do usuário: *"no final das contas é o mesmo projeto, a landing page
vai ter a aba de cadastro e login que vai levar ao app"*.

Três problemas concretos que a separação já causa:

1. **O sistema visual está duplicado à mão.** Os pretos (`#080808`, `#101010`,
   `#181818`, `#222222`), a rampa de texto (`#ebebea`, `#bab8b5`, `#837f7a`,
   `#474542`) e o ouro da logo (`#c49c5c`) estão escritos nos dois projetos,
   em `constants/tokens.ts` e em `app/globals.css`. O **mesmo comentário**
   explicando por que o `text2` foi clareado de `#74716c` aparece nos dois
   arquivos. Mudar a marca hoje exige lembrar dos dois lugares, e nada avisa
   quando eles desencostam.
2. **São dois Supabase desconectados.** O app tem `.env.local` apontando para
   um projeto; o site não tem `.env.local` nenhum e a migração
   `0001_lista_espera.sql` nunca foi aplicada. Cadastro no site e conta no app
   não têm como ser a mesma coisa.
3. **A regra de negócio não é acessível ao site.** As 566 linhas de `lib/`
   (`payouts`, `standings`, `timer`, `torneio`) são módulos puros, rodam em
   node, têm 391 linhas de teste, e hoje só o app enxerga.

## Mudança de rumo do produto, registrada aqui

O plano anterior era **iOS primeiro, web depois**. Em 16/09/2026 o usuário
inverteu: **web primeiro, mobile depois**. O login da landing vai desembocar
no app rodando no navegador.

Isso é o que torna o Expo a escolha certa para a versão web: o app **já está
configurado para web** (`app.json` tem `"bundler": "metro"` com
`"output": "static"`, e `react-native-web` + `react-dom` + `expo-router` já
instalados). Falta só `@expo/metro-runtime`.

## A forma escolhida

Três caminhos foram considerados. O escolhido é o primeiro.

**A. Monorepo com os dois, cada um no que já é bom.** Nada é reescrito.
**B. Tudo em Next**, reescrevendo o app para web. Jogaria fora ~3.100 linhas
de tela em React Native, e o mobile viraria um segundo trabalho do zero.
**C. Tudo em Expo**, a landing virando React Native Web. A landing não
sobreviveria: as 778 linhas do `Ficha3D.tsx`, o CSS afinado e o SEO da página
de vendas não têm equivalente decente no `react-native-web`.

### Estrutura alvo

```
kings-table/
  package.json            workspaces: ["apps/*", "packages/*"]
  apps/
    site/                 Next 16 + three.js (a landing de hoje, intacta)
    app/                  Expo (web agora, mobile depois)
  packages/
    ui/                   tokens visuais
    core/                 payouts, standings, timer, torneio
    db/                   cliente Supabase, tipos e migrações
  docs/
    PROJETO-site.md       1.103 linhas, preservado
    PROJETO-app.md        299 linhas, preservado
```

Os dois `PROJETO.md` não podem ocupar a raiz ao mesmo tempo. Viram dois
arquivos em `docs/`, sem perder uma linha: são documentos de passagem caros,
escritos para quem for continuar o trabalho.

## Restrição do usuário: a landing não pode ser alterada

Pedido explícito em 16/09/2026: *"só foque eu não alterar nada na landing page
agora"*.

Isso é **restrição de escopo, não preferência**, e reduz o que esta etapa pode
fazer. Duas consequências, as duas deliberadas:

### 1. As versões de React NÃO são unificadas agora

O desenho original propunha fixar tudo em 19.1.0, a versão que o Expo SDK 54
exige. Isso mexeria no `package.json` da landing, então está fora.

| | app (Expo 54) | site (Next 16) |
|---|---|---|
| react | 19.1.0 | 19.2.8 |
| react-dom | 19.1.0 | 19.2.8 |
| @supabase/supabase-js | 2.104.0 | 2.116.0 |

As duas versões passam a conviver por `node_modules` aninhado, que o npm
resolve sozinho. O custo recai sobre o Metro, que é rigoroso com resolução: o
`metro.config.js` do app precisa declarar `watchFolders` (a raiz do monorepo)
e `nodeModulesPaths` (o `node_modules` do próprio app **antes** do da raiz).
Hoje ele é o default de três linhas.

Unificar o React vira dívida registrada, para quando o usuário liberar a
landing.

### 2. Os `packages/` nascem servindo só o app

Extrair os tokens para `packages/ui` obrigaria o `globals.css` da landing a
importar de fora, o que é alterar a landing. Então:

- `packages/ui` nasce com os valores idênticos aos dos dois projetos, mas
  **só o app consome**. A landing continua com seu `globals.css` como está.
- `packages/core` recebe os módulos puros vindos do app. Ninguém mais consome
  ainda, mas é movimento interno ao app, que é onde há permissão para mexer.
- `packages/db` nasce com as duas migrações lado a lado
  (`20260420000001_initial_schema.sql` e `0001_lista_espera.sql`). Nenhuma é
  aplicada nesta etapa.

Quando a landing for liberada, o `globals.css` passa a ser gerado a partir do
`packages/ui` e a duplicação morre de verdade. Até lá, a fonte única existe
mas tem um consumidor só.

**O que a landing sofre nesta etapa: mudança de endereço e nada mais.** O
conteúdo de `kings-table-site/` chega em `apps/site/` byte por byte igual.

## Endereços

Landing em `kingstable.com`, app em `app.kingstable.com`. É o padrão de SaaS,
mantém o cookie de sessão compartilhado entre os dois, e evita costurar duas
stacks de renderização sob o mesmo caminho.

## Histórico do git

Os dois históricos são **preservados**, não achatados. O repositório unificado
nasce com os commits dos dois lados, cada um reescrito para o seu subdiretório
(`apps/app/...` e `apps/site/...`).

Meses de contexto vivem nessas mensagens de commit. Um commit inicial único
apagaria isso, e é gratuito evitar.

O remoto existente do app (`github.com/WinistonAlle/kings-table-app`) não é
descartado: o monorepo passa a ser a origem, e a decisão de manter ou
renomear o repositório no GitHub fica para a execução.

## Fora de escopo nesta etapa

Escrito para não haver dúvida depois:

- **A tela de login e a área logada.** São a próxima etapa, não esta.
- **Aplicar qualquer migração no Supabase.** As migrações só mudam de lugar.
- **Unificar as versões de React.** Bloqueado pela restrição da landing.
- **Fazer a landing consumir `packages/ui`.** Mesmo motivo.
- **Publicar na Vercel.** O site segue sem deploy, como está hoje.

## Critério de pronto

1. Existe um repositório só, com os dois projetos dentro.
2. `git log` mostra commits anteriores a 16/09/2026 dos **dois** projetos.
3. O build do site passa, sem nenhuma alteração no código dele.
4. O build do app passa, incluindo a saída web.
5. `npm run testes` do app continua verde (as 4 suítes).
6. Os dois `PROJETO.md` estão em `docs/`, íntegros.

## Armadilhas conhecidas

- **Expo em monorepo quebra por resolução de módulo**, não por configuração de
  workspace. O sintoma costuma ser "Unable to resolve module" apontando para
  um pacote que existe. A causa é o Metro não procurar no `node_modules` certo.
- **`reactStrictMode: false` é intencional no portfólio**, não neste projeto.
  Não confundir os dois ao copiar configuração.
- O app tem sobras mortas já identificadas: `App.tsx` (template do Expo, não
  usado, o roteador entra por `index.ts`), `global.css` (resto do NativeWind) e
  `react-native-mmkv` instalado sem uso. **Não limpar nesta etapa**: misturar
  limpeza com mudança de estrutura torna impossível saber o que quebrou o quê.
