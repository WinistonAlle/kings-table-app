# Repositorio oficial

Registrado em 16/09/2026.

- Pasta de trabalho: `/Users/winistonalle/Desktop/projetos/pessoal/kings-table`.
- Remoto: `https://github.com/WinistonAlle/kings-table-app.git`.
- Branch principal: `main`, acompanhando `origin/main`.
- O repositorio existente recebeu o monorepo sem force push, preservando os
  historicos do app e da landing. O nome remoto permanece `kings-table-app`.
- Landing: `http://localhost:3001/`, iniciada com `npm run site` na raiz.
- Sistema: `http://localhost:8081/`, iniciado com `npm run app` na raiz.

## Verificacao do GitHub

Uma copia nova foi clonada do remoto. A instalacao inicial revelou que os
workspaces core e db estavam ausentes do lockfile. A correcao foi publicada
no commit `772decf`, sem atualizar versoes de dependencias.

Depois da correcao, todos estes comandos passaram na copia clonada:

- `npm ci` na raiz.
- `npm run testes` na raiz: oito suites.
- `npm run site:build` na raiz, incluindo TypeScript da landing.
- `npx tsc --noEmit` em `apps/app`.
- `npx expo export --platform web` em `apps/app`: 16 rotas exportadas.

A instalacao reportou 21 vulnerabilidades de dependencias (12 moderadas,
9 altas). Nao foi aplicado `npm audit fix --force`; a revisao dessas
dependencias deve ocorrer em uma etapa separada.

## Originais e backup

As pastas antigas foram retiradas da area de projetos ativos e movidas,
inteiras, para:

`/Users/winistonalle/Desktop/projetos/pessoal/_backup-kings-table-2026-09-16/originais-arquivados/`

Elas sao arquivo de recuperacao, nao pastas de desenvolvimento. Seus arquivos
nao commitados e configuracoes locais foram preservados. Os arquivos tar.gz
e o patch de tokens do backup inicial tambem permanecem intactos.

Nao apagar o backup antes de cadastro e login estarem funcionando e terem
sido validados. Antes de excluir definitivamente, conferir que nao existem
configuracoes ou arquivos locais ainda necessarios apenas nos originais.

Reabrir o projeto no editor e nos agentes usando a pasta oficial acima.
Nao continuar tarefas na pasta antiga ou nas copias arquivadas.

## Proxima etapa

Cadastro e login ainda nao foram implementados. Continuam pendentes a
conexao efetiva dos tokens compartilhados e a configuracao local do
Supabase em `apps/app` (o `.env.local` original esta no arquivo de
recuperacao, nao foi publicado no GitHub).
