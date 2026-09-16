# Monorepo King's Table: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unir `kings-table-app` e `kings-table-site` num repositório único com npm workspaces, preservando os dois históricos de commit, sem alterar a landing e sem tocar no banco.

**Architecture:** Monorepo com `apps/site` (Next 16), `apps/app` (Expo SDK 54) e `packages/{ui,core,db}`. A união é feita com `git subtree add`, que traz o histórico completo de cada repositório sem escrever nos originais. As duas versões de React convivem por `node_modules` aninhado, o que exige configurar a resolução do Metro.

**Tech Stack:** npm workspaces (npm 11.6.1), git subtree (git 2.50.1), Next 16.3.5, Expo SDK 54, Node 24.11.0.

---

## Contexto que o executor precisa saber

**Os caminhos de origem:**
- App: `~/Desktop/projetos/pessoal/kings-table-app` (branch `main`, remoto `github.com/WinistonAlle/kings-table-app`)
- Site: `~/Desktop/projetos/pessoal/kings-table-site` (branch `main`, **sem remoto**)
- Destino: `~/Desktop/projetos/pessoal/kings-table`

**Três fatos verificados em 16/09/2026 que mudam o trabalho:**

1. **`git subtree` está disponível e funciona aqui.** Foi ensaiado num descartável: 70 commits preservados, os dois históricos intactos, os repositórios de origem não sofreram escrita nenhuma (reflog sem entradas novas). `git-filter-repo` NÃO está instalado e não é necessário.

2. **O `subtree` traz o conteúdo COMMITADO.** A alteração não commitada do usuário em `constants/tokens.ts` **se perde** se ninguém a carregar de propósito. Confirmado no ensaio: o arquivo chegou no monorepo com `text2: '#74716c'` enquanto o arquivo de trabalho tem `text2: '#837f7a'`. Ver Task 4.

3. **O app tem OITO suítes de teste**, não quatro. O script `testes` roda: `teste-logica`, `teste-timer`, `teste-torneio`, `teste-persistencia`, `teste-mesas`, `teste-estrutura`, `teste-noite`, `teste-assentos`.

**Restrições inegociáveis:**

- **A landing não muda.** `apps/site/app/`, `apps/site/components/` e `apps/site/public/` ficam byte por byte iguais. Só `apps/site/scripts/` (ferramenta de verificação, nada renderizado) pode mudar, e só a porta.
- **O banco não muda.** Nenhuma migração é aplicada. Elas só mudam de lugar.
- **Nada de force push.** Nada de reescrever os repositórios de origem. Eles ficam onde estão, intactos, até o usuário mandar removê-los.
- **React não é unificado** nesta etapa (site 19.2.8, app 19.1.0).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `package.json` (raiz) | Declara os workspaces e os scripts de preview nas portas fixas |
| `.gitignore` (raiz) | Ignora `node_modules`, saídas de build e a pasta `output/` dos dois projetos |
| `apps/app/metro.config.js` | Ensina o Metro a resolver num monorepo (o ponto que quebra se ficar de fora) |
| `packages/ui/package.json` + `tokens.ts` | Tokens visuais, fonte única. Só o app consome nesta etapa |
| `packages/core/package.json` | Casca do pacote de regra de negócio |
| `packages/db/package.json` + `migrations/` | As duas migrações lado a lado, nenhuma aplicada |
| `docs/PROJETO-app.md` | Documento de passagem do app, 299 linhas |
| `docs/PROJETO-site.md` | Documento de passagem do site, 1.103 linhas |
| `docs/PROXIMA-ETAPA.md` | Registro da sessão compartilhada, que é o trabalho seguinte |

---

### Task 1: Backup dos dois repositórios

Antes de qualquer coisa. Se algo der errado adiante, é daqui que se volta.

**Files:**
- Create: `~/Desktop/projetos/pessoal/_backup-kings-table-2026-09-16/`

- [ ] **Step 1: Criar a pasta de backup**

```bash
mkdir -p ~/Desktop/projetos/pessoal/_backup-kings-table-2026-09-16
```

- [ ] **Step 2: Arquivar os dois repositórios, excluindo node_modules**

`node_modules` fica de fora de propósito: são 407 MB e 675 MB quase todos de dependência reinstalável, e incluí-los faria o backup demorar minutos sem proteger nada.

```bash
cd ~/Desktop/projetos/pessoal
tar --exclude='node_modules' --exclude='.next' --exclude='dist' \
  -czf _backup-kings-table-2026-09-16/kings-table-app.tar.gz kings-table-app
tar --exclude='node_modules' --exclude='.next' --exclude='dist' \
  -czf _backup-kings-table-2026-09-16/kings-table-site.tar.gz kings-table-site
```

- [ ] **Step 3: Verificar que os backups não estão vazios e contêm o .git**

```bash
ls -lh ~/Desktop/projetos/pessoal/_backup-kings-table-2026-09-16/
tar -tzf ~/Desktop/projetos/pessoal/_backup-kings-table-2026-09-16/kings-table-app.tar.gz | grep -c "^kings-table-app/.git/"
tar -tzf ~/Desktop/projetos/pessoal/_backup-kings-table-2026-09-16/kings-table-site.tar.gz | grep -c "^kings-table-site/.git/"
```

Expected: os dois `.tar.gz` com tamanho maior que 1 MB, e os dois `grep -c` retornando um número maior que zero.

**Se qualquer um dos dois contadores for 0, PARE.** Sem o `.git` dentro do arquivo, o backup não protege o histórico, que é justamente o que este plano arrisca.

- [ ] **Step 4: Guardar o HEAD de cada repositório em texto**

Serve de conferência independente no fim: os commits que estavam lá antes precisam continuar alcançáveis depois.

```bash
cd ~/Desktop/projetos/pessoal
{
  echo "app  HEAD: $(git -C kings-table-app rev-parse HEAD)"
  echo "site HEAD: $(git -C kings-table-site rev-parse HEAD)"
  echo "app  commits: $(git -C kings-table-app rev-list --count HEAD)"
  echo "site commits: $(git -C kings-table-site rev-list --count HEAD)"
} | tee _backup-kings-table-2026-09-16/HEADS.txt
```

Expected: quatro linhas impressas e gravadas no arquivo.

- [ ] **Step 5: Salvar a alteração não commitada do usuário**

Esta é a alteração de contraste em `constants/tokens.ts`. Ela não está em nenhum commit, então o backup do `.git` **não** a contém. Precisa ser salva como patch, separada.

```bash
cd ~/Desktop/projetos/pessoal/kings-table-app
git diff constants/tokens.ts > ../_backup-kings-table-2026-09-16/tokens-nao-commitado.patch
wc -l ../_backup-kings-table-2026-09-16/tokens-nao-commitado.patch
```

Expected: o arquivo tem cerca de 14 linhas. Se tiver 0, a alteração sumiu antes do backup e é preciso perguntar ao usuário antes de continuar.

---

### Task 2: Criar o esqueleto do monorepo

**Files:**
- Create: `~/Desktop/projetos/pessoal/kings-table/package.json`
- Create: `~/Desktop/projetos/pessoal/kings-table/.gitignore`

- [ ] **Step 1: Inicializar o repositório**

```bash
mkdir -p ~/Desktop/projetos/pessoal/kings-table
cd ~/Desktop/projetos/pessoal/kings-table
git init -b main
```

- [ ] **Step 2: Escrever o `package.json` da raiz**

As portas 3001 e 8081 são pedido explícito do usuário. `--port 8081` é redundante (é o padrão do Expo) mas fica escrito para não depender de padrão que pode mudar de versão.

```json
{
  "name": "kings-table",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "site": "npm run dev --workspace=kings-table-site -- --port 3001",
    "site:build": "npm run build --workspace=kings-table-site",
    "site:preview": "npm run start --workspace=kings-table-site -- --port 3001",
    "app": "npm run web --workspace=kings-table-app -- --port 8081",
    "app:nativo": "npm run start --workspace=kings-table-app -- --port 8081",
    "testes": "npm run testes --workspace=kings-table-app"
  }
}
```

- [ ] **Step 3: Escrever o `.gitignore` da raiz**

`output/` aparece porque os dois projetos geram essa pasta e ela já estava suja de arquivos não versionados no site.

```
node_modules/
.next/
dist/
output/
.expo/
.playwright-cli/
*.tsbuildinfo
.env.local
.DS_Store
```

- [ ] **Step 4: Fazer o commit raiz**

O `subtree add` exige que o repositório tenha pelo menos um commit. Este é ele.

```bash
cd ~/Desktop/projetos/pessoal/kings-table
git add package.json .gitignore
git commit -m "Raiz do monorepo: workspaces e portas de preview"
```

- [ ] **Step 5: Verificar**

```bash
git -C ~/Desktop/projetos/pessoal/kings-table log --oneline
```

Expected: exatamente um commit, `Raiz do monorepo: workspaces e portas de preview`.

---

### Task 3: Trazer os dois projetos com o histórico

Esta é a operação que o plano existe para acertar. Os comandos abaixo foram **executados de verdade** num descartável em 16/09/2026 e funcionaram.

**Files:**
- Create: `apps/app/` (vindo do repositório do app)
- Create: `apps/site/` (vindo do repositório do site)

- [ ] **Step 1: Trazer o app**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
git subtree add --prefix=apps/app ~/Desktop/projetos/pessoal/kings-table-app main
```

Expected: a saída termina com `Added dir 'apps/app'`.

- [ ] **Step 2: Trazer o site**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
git subtree add --prefix=apps/site ~/Desktop/projetos/pessoal/kings-table-site main
```

Expected: a saída termina com `Added dir 'apps/site'`.

- [ ] **Step 3: Verificar que os dois históricos vieram**

Este é o critério de pronto número 2 do spec. Os quatro commits abaixo são os que o usuário nomeou: agendamento, assentos, auditoria e os preços da landing.

```bash
cd ~/Desktop/projetos/pessoal/kings-table
echo "total de commits: $(git rev-list --count HEAD)"
git log --oneline | grep -iE "seat organization|night scheduling|tournament TV|Home Clube Pro"
```

Expected: mais de 60 commits no total, e as quatro linhas abaixo presentes:

```
Add seat organization local audit and sensitive action confirmations
Add night scheduling attendance waitlist and check-in
Apply Home Clube Pro and Passe pricing to landing
feat: add tournament TV display mode
```

**Se o total de commits for 3, o subtree achatou o histórico.** Provavelmente alguém passou `--squash`. Desfaça com `git reset --hard` para o commit raiz e refaça sem a flag.

- [ ] **Step 4: Verificar que os repositórios de origem continuam intactos**

Requisito explícito do usuário: não reescrever os originais.

```bash
cd ~/Desktop/projetos/pessoal
diff <(cat _backup-kings-table-2026-09-16/HEADS.txt) <(
  echo "app  HEAD: $(git -C kings-table-app rev-parse HEAD)"
  echo "site HEAD: $(git -C kings-table-site rev-parse HEAD)"
  echo "app  commits: $(git -C kings-table-app rev-list --count HEAD)"
  echo "site commits: $(git -C kings-table-site rev-list --count HEAD)"
) && echo "ORIGINAIS INTACTOS"
```

Expected: imprime `ORIGINAIS INTACTOS` e nada mais. Qualquer diferença significa que uma escrita vazou para os originais: **pare e avise o usuário.**

- [ ] **Step 5: Verificar que os arquivos chegaram**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
echo "suites de teste: $(ls apps/app/testes/ | wc -l | tr -d ' ')"
echo "scripts do site: $(ls apps/site/scripts/ | wc -l | tr -d ' ')"
```

Expected: `suites de teste: 8` e `scripts do site: 11`.

---

### Task 4: Recuperar a alteração não commitada dos tokens

Sem esta task o `text2` volta para `#74716c` e o contraste cai de 5,04:1 para 4,12:1, abaixo do mínimo de 4,5:1 que texto normal exige. É regressão de acessibilidade silenciosa.

**Files:**
- Modify: `apps/app/constants/tokens.ts`

- [ ] **Step 1: Confirmar que o valor velho é o que está lá**

```bash
grep -n "text2:" ~/Desktop/projetos/pessoal/kings-table/apps/app/constants/tokens.ts
```

Expected: `text2: '#74716c',` (o valor **velho**, confirmando que a alteração se perdeu no subtree, como previsto).

- [ ] **Step 2: Aplicar o patch guardado no backup**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
git apply --directory=apps/app \
  ~/Desktop/projetos/pessoal/_backup-kings-table-2026-09-16/tokens-nao-commitado.patch
```

Expected: nenhuma saída (sucesso silencioso).

Se der `error: patch failed`, aplique à mão: em `apps/app/constants/tokens.ts`, troque a linha `text2: '#74716c',` por:

```ts
  /* Clareado de #74716c: ele carrega o texto corrido e tinha 4,12:1 sobre o
     preto do sistema, abaixo dos 4,5:1 que texto normal pede. Agora 5,04:1. */
  text2: '#837f7a',
```

- [ ] **Step 3: Verificar que o valor novo está lá**

```bash
grep -n "text2:" ~/Desktop/projetos/pessoal/kings-table/apps/app/constants/tokens.ts
```

Expected: `text2: '#837f7a',`

- [ ] **Step 4: Confirmar que agora app e site concordam**

Os dois projetos passam a ter o mesmo valor, que é o ponto de partida para a fonte única do `packages/ui`.

```bash
cd ~/Desktop/projetos/pessoal/kings-table
grep -h "837f7a" apps/app/constants/tokens.ts apps/site/app/globals.css
```

Expected: duas linhas, uma de cada arquivo.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
git add apps/app/constants/tokens.ts
git commit -m "Recupera a correcao de contraste do text2 que nao estava commitada

O subtree traz o conteudo commitado, e esta alteracao vivia so na arvore de
trabalho do repositorio de origem. Sem recuperar, o text2 voltaria a #74716c
e o contraste cairia de 5,04:1 para 4,12:1, abaixo do minimo de 4,5:1."
```

---

### Task 5: Mover os dois PROJETO.md para docs/

Os dois não podem ocupar a raiz. São 1.402 linhas somadas de contexto caro, então mudam de lugar sem perder nada.

**Files:**
- Create: `docs/PROJETO-app.md` (movido de `apps/app/PROJETO.md`)
- Create: `docs/PROJETO-site.md` (movido de `apps/site/PROJETO.md`)

- [ ] **Step 1: Mover os dois com `git mv`**

`git mv` e não `mv`: preserva o rastreamento de renomeação no histórico.

```bash
cd ~/Desktop/projetos/pessoal/kings-table
mkdir -p docs
git mv apps/app/PROJETO.md docs/PROJETO-app.md
git mv apps/site/PROJETO.md docs/PROJETO-site.md
```

- [ ] **Step 2: Verificar que nenhuma linha se perdeu**

```bash
wc -l ~/Desktop/projetos/pessoal/kings-table/docs/PROJETO-app.md \
      ~/Desktop/projetos/pessoal/kings-table/docs/PROJETO-site.md
```

Expected: `299` para o do app e `1103` para o do site.

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
git add -A docs apps
git commit -m "Move os dois documentos de passagem para docs/

Os dois se chamavam PROJETO.md e nao cabem na mesma raiz. Nenhuma linha
mudou: 299 do app e 1103 do site."
```

---

### Task 6: Ensinar o Metro a resolver num monorepo

Este é o ponto que quebra o app se ficar de fora. O `metro.config.js` de hoje tem três linhas e assume que `node_modules` está ao lado. Com workspaces, a maior parte das dependências sobe para a raiz, mas o React do app (19.1.0) fica aninhado porque o site usa 19.2.8. O Metro precisa procurar nos dois lugares, **na ordem certa**.

**Files:**
- Modify: `apps/app/metro.config.js`

- [ ] **Step 1: Ver o que existe hoje**

```bash
cat ~/Desktop/projetos/pessoal/kings-table/apps/app/metro.config.js
```

Expected:

```js
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
```

- [ ] **Step 2: Reescrever o arquivo**

A ordem de `nodeModulesPaths` é o que importa: o `node_modules` do próprio app vem **primeiro**, para que o React 19.1.0 aninhado ganhe do 19.2.8 hoisted na raiz. Inverter a ordem faz o Expo carregar a versão errada do React e quebrar em tempo de execução, não de build, que é o pior tipo de quebra.

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const raizDoApp = __dirname;
const raizDoMonorepo = path.resolve(raizDoApp, '../..');

const config = getDefaultConfig(raizDoApp);

/* Num monorepo o Metro precisa ser ensinado duas coisas.
 *
 * 1. QUE ARQUIVOS OBSERVAR. Por padrao ele so olha a pasta do app, entao
 *    mudanca em packages/ nao recarregaria nada.
 * 2. ONDE PROCURAR MODULO, E EM QUE ORDEM. O node_modules do app vem
 *    PRIMEIRO de proposito: o site usa React 19.2.8 e o Expo SDK 54 exige
 *    19.1.0, entao o React do app fica aninhado enquanto o do site sobe
 *    para a raiz. Invertendo a ordem, o app carrega o React do site e
 *    quebra em tempo de execucao, que e mais caro de diagnosticar do que
 *    uma falha de build.
 */
config.watchFolders = [raizDoMonorepo];
config.resolver.nodeModulesPaths = [
  path.resolve(raizDoApp, 'node_modules'),
  path.resolve(raizDoMonorepo, 'node_modules')
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
```

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
git add apps/app/metro.config.js
git commit -m "Metro: resolucao de modulo para monorepo

watchFolders na raiz para que mudanca em packages/ recarregue, e
nodeModulesPaths com o node_modules do app PRIMEIRO, porque o React do app
(19.1.0, exigido pelo Expo 54) fica aninhado enquanto o do site (19.2.8)
sobe para a raiz."
```

---

### Task 7: Instalar e provar que os dois buildam

**Files:**
- Modify: `apps/app/package.json` (só a dependência que falta)

- [ ] **Step 1: Instalar o workspace inteiro**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
npm install
```

Expected: termina sem `ERESOLVE`. Um aviso de peer dependency é aceitável; um erro não.

- [ ] **Step 2: Confirmar que as duas versões de React coexistem**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
echo "raiz: $(node -p "require('./node_modules/react/package.json').version")"
echo "app:  $(node -p "require('./apps/app/node_modules/react/package.json').version" 2>/dev/null || echo 'hoisted na raiz')"
```

Expected: uma das duas situações é aceitável. Ou a raiz tem 19.2.8 e o app tem 19.1.0 aninhado, ou a raiz tem 19.1.0 e o site tem o 19.2.8 aninhado. O que **não** pode acontecer é só uma versão existir: nesse caso um dos dois projetos está rodando com o React do outro.

- [ ] **Step 3: Adicionar a dependência de web que falta no app**

`@expo/metro-runtime` é exigido pelo Expo para rodar na web e não está instalado. O `app.json` já declara `"output": "static"`, então o resto da configuração de web já existe.

```bash
cd ~/Desktop/projetos/pessoal/kings-table
npm install @expo/metro-runtime --workspace=kings-table-app
```

- [ ] **Step 4: Rodar as oito suítes do app**

Este é o portão de regressão do plano inteiro. Rode depois de cada task daqui para frente.

```bash
cd ~/Desktop/projetos/pessoal/kings-table
npm run testes
```

Expected: as oito suítes passam. Se qualquer uma falhar, o problema é de resolução de módulo (Task 6), não de regra de negócio: nenhuma linha de lógica foi tocada até aqui.

- [ ] **Step 5: Buildar o site**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
npm run site:build
```

Expected: `Compiled successfully`. O código do site não foi tocado, então uma falha aqui é de resolução no workspace, não da landing.

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
git add package-lock.json apps/app/package.json
git commit -m "Instala o workspace e adiciona @expo/metro-runtime

O app ja declarava output static no app.json mas nao tinha o runtime de web
instalado. As oito suites passam e o build do site compila."
```

---

### Task 8: Apontar os scripts de verificação do site para a porta 3001

Dez arquivos em `apps/site/scripts/` apontam para `localhost:3210`. Com o preview na 3001, todos param de funcionar.

**Isto toca o projeto do site, e é deliberado:** `scripts/` é ferramenta de verificação, nada ali é renderizado para o visitante. `app/`, `components/` e `public/`, que são a landing de verdade, continuam intocados.

**Files:**
- Modify: `apps/site/scripts/dobras.js`, `pousa.js`, `faixa.js`, `pouso.js`, `fluidez.js`, `mesa3d.js`, `larguras.js`, `tour.js`, `piscada.js`
- Modify: `docs/PROJETO-site.md` (a seção "Como rodar" cita a porta)

- [ ] **Step 1: Listar o que vai mudar, antes de mudar**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
grep -rln "3210" apps/site/scripts/ docs/PROJETO-site.md
```

Expected: nove arquivos em `apps/site/scripts/` mais o `docs/PROJETO-site.md`.

- [ ] **Step 2: Trocar a porta**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
grep -rl "3210" apps/site/scripts/ docs/PROJETO-site.md | xargs sed -i '' 's/3210/3001/g'
```

- [ ] **Step 3: Confirmar que não sobrou nenhuma ocorrência**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
grep -rn "3210" apps/site/ docs/ | grep -v node_modules || echo "NENHUMA OCORRENCIA RESTANTE"
```

Expected: `NENHUMA OCORRENCIA RESTANTE`.

- [ ] **Step 4: Confirmar que a landing em si não foi tocada**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
git status --short apps/site/app apps/site/components apps/site/public
```

Expected: **saída vazia**. Se aparecer qualquer arquivo, o `sed` pegou mais do que devia: desfaça com `git checkout -- apps/site/app apps/site/components apps/site/public` e refaça restringindo o alvo.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
git add apps/site/scripts docs/PROJETO-site.md
git commit -m "Scripts de verificacao do site na porta 3001

Pedido do usuario: preview do site na 3001 e do app na 8081. Os dez alvos
sao ferramenta de verificacao; app/, components/ e public/ da landing nao
foram tocados."
```

---

### Task 9: Criar packages/ui com a fonte única dos tokens

Nesta etapa **só o app consome**. Fazer a landing importar daqui exigiria mexer no `globals.css` dela, o que está fora de escopo.

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tokens.ts`

- [ ] **Step 1: Criar o `package.json` do pacote**

```json
{
  "name": "@kings-table/ui",
  "version": "0.0.0",
  "private": true,
  "main": "tokens.ts",
  "types": "tokens.ts"
}
```

- [ ] **Step 2: Copiar os tokens do app como ponto de partida**

O arquivo do app já é a versão correta depois da Task 4. Copiar em vez de reescrever garante que os comentários (que explicam o porquê de cada decisão) venham junto.

```bash
cd ~/Desktop/projetos/pessoal/kings-table
mkdir -p packages/ui
cp apps/app/constants/tokens.ts packages/ui/tokens.ts
```

- [ ] **Step 3: Confirmar que a correção de contraste veio junto**

```bash
grep -n "837f7a" ~/Desktop/projetos/pessoal/kings-table/packages/ui/tokens.ts
```

Expected: a linha `text2: '#837f7a',` presente. Se vier `#74716c`, a Task 4 não foi feita: volte e faça antes de seguir.

- [ ] **Step 4: Instalar o pacote como dependência do app**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
npm install @kings-table/ui --workspace=kings-table-app
```

- [ ] **Step 5: Rodar as oito suítes**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
npm run testes
```

Expected: as oito passam. Nada foi religado ainda, então isto está provando que criar o pacote não quebrou a resolução.

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
git add packages/ui package.json package-lock.json apps/app/package.json
git commit -m "packages/ui: tokens visuais como fonte unica

Nesta etapa so o app consome. Ligar a landing exigiria mexer no globals.css
dela, que esta fora do escopo por pedido do usuario. O arquivo ja nasce com
a correcao de contraste do text2 recuperada na etapa anterior."
```

---

### Task 10: Criar packages/core e packages/db

Os dois nascem como casca nesta etapa. Mover a regra de negócio para dentro do `core` e religar os imports é trabalho que muda o app de verdade, e merece ser feito em separado, com as oito suítes como rede.

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/README.md`
- Create: `packages/db/package.json`
- Create: `packages/db/migrations/20260420000001_initial_schema.sql`
- Create: `packages/db/migrations/0001_lista_espera.sql`
- Create: `packages/db/README.md`

- [ ] **Step 1: Criar o `packages/core/package.json`**

```json
{
  "name": "@kings-table/core",
  "version": "0.0.0",
  "private": true
}
```

- [ ] **Step 2: Criar o `packages/core/README.md`**

```markdown
# @kings-table/core

Regra de negócio pura, compartilhada entre o app e o site.

**Ainda vazio.** O conteúdo vem de `apps/app/lib/`: `payouts.ts`,
`standings.ts`, `timer.ts` e `torneio.ts`, que já são módulos puros e rodam
em node (é por isso que as oito suítes em `apps/app/testes/` funcionam sem
simulador).

A mudança foi deixada de fora da etapa de unificação de propósito: mover os
módulos e religar os imports altera o app, e misturar isso com mudança de
estrutura tornaria impossível saber o que quebrou o quê.
```

- [ ] **Step 3: Criar o `packages/db/package.json`**

```json
{
  "name": "@kings-table/db",
  "version": "0.0.0",
  "private": true
}
```

- [ ] **Step 4: Copiar as duas migrações para o mesmo lugar**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
mkdir -p packages/db/migrations
cp apps/app/supabase/migrations/20260420000001_initial_schema.sql packages/db/migrations/
cp apps/site/supabase/migrations/0001_lista_espera.sql packages/db/migrations/
ls packages/db/migrations/
```

Expected: os dois arquivos listados.

- [ ] **Step 5: Criar o `packages/db/README.md`**

```markdown
# @kings-table/db

Migrações e, futuramente, o cliente Supabase compartilhado.

**Nenhuma destas migrações foi aplicada.** Elas só mudaram de lugar. Aplicar
qualquer uma está fora do escopo da etapa de unificação, por pedido explícito
do usuário.

- `20260420000001_initial_schema.sql` vem do app. **Já está aplicada** no
  Supabase do app (9 tabelas, RLS, Realtime, bucket de Storage).
- `0001_lista_espera.sql` vem do site. **Nunca foi aplicada em lugar nenhum**,
  e é por isso que a lista de espera da landing não recebe um e-mail sequer.

As cópias originais continuam em `apps/app/supabase/` e `apps/site/supabase/`.
Elas serão removidas de lá quando o cliente compartilhado existir e os dois
projetos passarem a ler daqui, o que é a próxima etapa.
```

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
git add packages/core packages/db
git commit -m "packages/core e packages/db como casca

As duas migracoes ficam lado a lado pela primeira vez, sem que nenhuma seja
aplicada. Mover a regra de negocio e religar imports altera o app e fica para
uma etapa propria, com as oito suites como rede."
```

---

### Task 11: Registrar a próxima etapa e verificar tudo

**Files:**
- Create: `docs/PROXIMA-ETAPA.md`
- Create: `README.md`

- [ ] **Step 1: Escrever `docs/PROXIMA-ETAPA.md`**

```markdown
# Próxima etapa: a sessão compartilhada

Registrado em 16/09/2026, a pedido do usuário, ao fechar a unificação.

## O que precisa existir

Login e cadastro na landing, levando ao app rodando no navegador. Hoje os
dois lados não se falam: o usuário se cadastra no site e isso não vira conta
no app.

**Tem que ser o mesmo Supabase.** Não dois projetos sincronizados, não um
espelho: a mesma instância, a mesma tabela de usuários. É o que faz "cadastro
no site" e "conta no app" serem a mesma coisa.

## O estado de hoje, que a próxima etapa herda

- O app tem `.env.local` apontando para um projeto Supabase e um cliente em
  `apps/app/lib/supabase.ts` que **nunca é chamado** em lugar nenhum.
- O site **não tem `.env.local`** e a migração da lista de espera nunca foi
  aplicada.
- As duas migrações já estão lado a lado em `packages/db/migrations/`,
  nenhuma aplicada.

## Ordem sugerida

1. Decidir qual projeto Supabase é o definitivo (provavelmente o do app, que
   já tem as 9 tabelas e o RLS).
2. Aplicar `0001_lista_espera.sql` nele.
3. Criar o cliente compartilhado em `packages/db`, e fazer os dois projetos
   lerem dele em vez de cada um ter o seu.
4. Só então a tela de login, e a sessão atravessando de `kingstable.com` para
   `app.kingstable.com`.

O subdomínio é o que permite a sessão atravessar: cookie de sessão em
`.kingstable.com` vale nos dois. Foi por isso que o subdomínio foi escolhido
em vez de `kingstable.com/app`.

## Dívidas que a unificação deixou de propósito

- **As versões de React não foram unificadas** (site 19.2.8, app 19.1.0),
  porque fixar exigiria mexer na landing. O Metro foi configurado para
  conviver com isso. Quando a landing puder ser tocada, unificar em 19.1.0.
- **A landing ainda não consome `packages/ui`.** Os tokens têm fonte única,
  mas com um consumidor só. Ligar a landing mata a duplicação de verdade.
- **`packages/core` está vazio.** Os módulos puros continuam em
  `apps/app/lib/`.
- **Sobras mortas no app**, não limpas de propósito para não misturar com a
  mudança de estrutura: `App.tsx` (template do Expo, não usado, o roteador
  entra por `index.ts`), `global.css` (resto do NativeWind) e
  `react-native-mmkv` instalado sem uso.
```

- [ ] **Step 2: Escrever o `README.md` da raiz**

```markdown
# King's Table

Monorepo do King's Table: o app e a landing no mesmo lugar.

| Pasta | O que é |
|---|---|
| `apps/site` | Landing page. Next 16 + three.js |
| `apps/app` | O app. Expo SDK 54, web agora e mobile depois |
| `packages/ui` | Tokens visuais, fonte única |
| `packages/core` | Regra de negócio compartilhada (ainda vazio) |
| `packages/db` | Migrações e cliente Supabase |

## Rodar

```bash
npm install

npm run site      # landing em http://localhost:3001
npm run app       # app web em http://localhost:8081
npm run testes    # as oito suites do app
```

## Antes de mexer

Leia `docs/PROJETO-site.md` e `docs/PROJETO-app.md`. São documentos de
passagem, com o porquê de cada decisão e as armadilhas que já custaram
retrabalho. `docs/PROXIMA-ETAPA.md` diz o que vem a seguir e o que ficou
como dívida consciente.
```

- [ ] **Step 3: Rodar a verificação final completa**

Os seis critérios de pronto do spec, conferidos de uma vez.

```bash
cd ~/Desktop/projetos/pessoal/kings-table
echo "1. repositorio unico:   $(git rev-parse --is-inside-work-tree)"
echo "2. commits preservados: $(git rev-list --count HEAD)"
git log --oneline | grep -ciE "seat organization|night scheduling|tournament TV|Home Clube Pro"
echo "6. documentos:          $(wc -l < docs/PROJETO-app.md) e $(wc -l < docs/PROJETO-site.md) linhas"
npm run testes && echo "5. as oito suites passaram"
npm run site:build && echo "3. build do site passou"
```

Expected: mais de 60 commits, o `grep -c` retornando 4, os documentos com 299 e 1103 linhas, as oito suítes passando e o build do site compilando.

- [ ] **Step 4: Provar que a landing não mudou uma linha**

O critério mais importante para o usuário. Compara a landing do monorepo com a do repositório original, que continua intacto.

```bash
diff -r \
  ~/Desktop/projetos/pessoal/kings-table-site/app \
  ~/Desktop/projetos/pessoal/kings-table/apps/site/app \
  && diff -r \
  ~/Desktop/projetos/pessoal/kings-table-site/components \
  ~/Desktop/projetos/pessoal/kings-table/apps/site/components \
  && echo "LANDING IDENTICA"
```

Expected: `LANDING IDENTICA`, sem nenhuma linha de diferença antes.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/projetos/pessoal/kings-table
git add README.md docs/PROXIMA-ETAPA.md
git commit -m "README e registro da proxima etapa

A sessao compartilhada (login na landing levando ao app web, no mesmo
Supabase) fica registrada com o estado que ela herda e as dividas que esta
etapa deixou de proposito."
```

---

### Task 12: Entregar, sem apagar nada

**Nada é removido nesta task.** Os repositórios originais e o backup continuam onde estão. Remover é decisão do usuário, depois de ele conferir com os próprios olhos.

- [ ] **Step 1: Subir os dois previews e conferir que respondem**

Rodar num terminal:

```bash
cd ~/Desktop/projetos/pessoal/kings-table && npm run site
```

Noutro:

```bash
cd ~/Desktop/projetos/pessoal/kings-table && npm run app
```

- [ ] **Step 2: Confirmar que cada porta responde o projeto certo**

Responder HTTP 200 não basta: com vários previews rodando, é fácil um servidor antigo responder na porta esperada e parecer sucesso.

```bash
echo "3001 (site):" && curl -s http://localhost:3001 | grep -oiE "<title>[^<]*</title>" | head -1
echo "8081 (app):"  && curl -s http://localhost:8081 | grep -oiE "<title>[^<]*</title>" | head -1
```

Expected: dois títulos diferentes, cada um correspondendo ao seu projeto. Se os dois vierem iguais, ou se algum vier vazio, há outro servidor ocupando a porta.

- [ ] **Step 3: Resumir ao usuário e perguntar sobre o remoto**

O que precisa da decisão dele, e por isso não está no plano:

1. **O que fazer com `github.com/WinistonAlle/kings-table-app`.** Vira o remoto do monorepo, ou nasce um repositório novo? Renomear um repositório no GitHub quebra os clones existentes.
2. **Quando apagar os originais** e o backup em `_backup-kings-table-2026-09-16/`.

Não faça `git push` e não mexa em remoto sem resposta: o usuário pediu explicitamente para ser consultado antes de qualquer force push ou reescrita.

---

## Se der errado

O backup da Task 1 é o caminho de volta, e os repositórios originais nunca são tocados. Para desfazer tudo:

```bash
rm -rf ~/Desktop/projetos/pessoal/kings-table
```

Os dois projetos continuam funcionando de onde sempre estiveram. A única coisa que precisa ser recuperada à mão é a alteração não commitada dos tokens, e ela está salva em
`_backup-kings-table-2026-09-16/tokens-nao-commitado.patch`.
