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
