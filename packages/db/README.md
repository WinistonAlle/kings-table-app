# @kings-table/db

Migrações e, futuramente, o cliente Supabase compartilhado.

Na unificacao, os arquivos apenas mudaram de lugar. Em 16/09/2026, a etapa
de copia online aplicou novas migracoes via MCP ao projeto
`hjxjxhnpcukwimiksbbz`.

- `20260420000001_initial_schema.sql` vem do app. **Já está aplicada** no
  Supabase do app (9 tabelas, RLS, Realtime, bucket de Storage).
- `0001_lista_espera.sql` vem do site. **Nunca foi aplicada em lugar nenhum**,
  e é por isso que a lista de espera da landing não recebe um e-mail sequer.

As cópias originais continuam em `apps/app/supabase/` e `apps/site/supabase/`.
Elas serão removidas de lá quando o cliente compartilhado existir e os dois
projetos passarem a ler daqui, o que é a próxima etapa.

## Copias online

O historico aplicado esta consolidado em `supabase/migrations/`. A inicial
foi reconstruida dos 53 statements do historico remoto, mantendo a versao
`20260420000001`. O MD5 do arquivo reconstruido foi conferido com a mesma
reconstrucao no servidor: `c1d4a55b62ab72fe77b1a01c3f0e4d81`.
As tres migracoes posteriores mantem suas versoes; as duas correcoes de
CHECK diferem do texto remoto apenas por comentarios e formatacao.
As copias antigas continuam preservadas em `migrations/` e nos apps.

`20260917013930_transactional_blind_presets.sql` e a primeira migracao
nova apos consolidacao: API de comandos para presets, revisoes, tombstones,
recibos/auditoria e leitura isolada. Aplicada somente no banco local, nao
no remoto. Ver contrato e limites em docs/SINCRONIZACAO.md. Nao usar db push
como parte dos testes; ativacao remota/UI e dominio de torneios pendentes.

Antes de qualquer `supabase db push`, conferir novamente o historico remoto,
validar novas alteracoes em banco isolado. A CLI canonica agora usa
`supabase/config.toml`, ID `kings-table-local` e portas 55320-55329,
separadas dos previews e de outros projetos locais. Em 16/09/2026, start
em banco novo e reset exclusivamente local aplicaram as quatro migracoes;
o historico local foi conferido e os testes SQL passaram. Isso nao comprova
igualdade completa com o schema remoto nem valida login por e-mail.
Nao reaplique a inicial nem a lista de
espera; `0001_lista_espera.sql` nao pertence ao historico aplicado.
Nenhum SQL desta consolidacao foi reaplicado no servidor.

`supabase/tests/account_backups.sql` testa RLS e concorrencia como postgres
em uma transacao com rollback. Nao modifica usuarios reais. A interface
oferece uma unica copia atual por conta, limite de 5 MB e salvamento manual;
nao representa sincronizacao ao vivo ou backups diarios automaticos.

## Verificacao Local

Requer Node, npx e Docker em execucao. Da raiz do monorepo:

```sh
npx supabase db start --workdir packages/db
npm run test:local --workspace @kings-table/db
npx supabase migration list --local --workdir packages/db
npx supabase stop --project-id kings-table-local --workdir packages/db
```

O runner acessa apenas o container `supabase_db_kings-table-local`, sem
aceitar URL de banco, projeto vinculado ou credenciais remotas. Valida o
historico esperado; executa a suite SQL com rollback; cria um ator aleatorio
e disputa uma revisao em duas conexoes Postgres. Confirma que a segunda
transacao realmente esperou pelo lock e recebeu 40001 apos o primeiro
commit. Verifica o resultado final e remove somente esse ator no finally.
Sessoes e statements possuem limites de tempo. Outros containers intactos.

O runner tambem executa `preset_operations.sql` (rollback) e disputa os
comandos de preset em duas conexoes: ID igual retorna recibo igual com um
efeito; IDs diferentes na mesma revisao resultam em um commit e 40001.
Verifica quantidade de recibos/auditoria e revisao final. Remove apenas
o preset UUID da fixture antes de apagar seu ator. Historico esperado agora
vem dos arquivos canonicos, incluindo a migracao nova somente local.

Testes incluem RLS de duas contas/anonimo, versao ausente/nula/invalida,
tamanho acima de 5 MB, revisao invalida e reassociacao do dono. Isso testa
Postgres real com papeis/JWT definidos na sessao, nao o login Auth nem
permissoes end-to-end do navegador. O teste anterior de revisao desatualizada
era sequencial; concorrencia real esta no runner separado.

`db reset --local --no-seed --workdir packages/db` apaga dados desse banco
local. Foi usado apenas no ambiente novo criado para QA. Nao executar em
ambiente com dados do usuario sem autorizacao. Nunca usar `--linked`,
`--all` ou `--no-backup` nesse fluxo. Nao existe deploy/push automatico.

Referencia: https://supabase.com/docs/guides/local-development/cli-workflows

## Auth E Transporte HTTP Local

Da raiz, iniciar apenas DB/Auth/API para teste separado do app:

```sh
npx supabase start --workdir packages/db --exclude realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
npm run test:sync-http-local --workspace kings-table-app
npx supabase stop --project-id kings-table-local --workdir packages/db
```

O runner nao aceita URL/key do ambiente. Confere endereco fixo 127.0.0.1:55321
da CLI local; cria duas contas aleatorias por signup e entra com senha.
Usa GoTrue/JWT/PostgREST reais, transporte do app e sender/outbox (IndexedDB
simulado). Perde uma resposta deliberadamente apos commit real e recupera
o mesmo recibo sem duplicar efeitos. Confere isolamento e contagem de auditoria.

Admin local usado somente para cleanup em Node. Fixtures removidas no finally.
Nao altera env do app nem contas remotas. Confirmacao de e-mail esta desabilitada
somente na config local; nenhuma verificacao de SMTP ou redirects foi feita.
Esse teste nao prova Auth/UI ou sincronizacao end-to-end no navegador.
