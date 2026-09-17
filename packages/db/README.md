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

Antes de qualquer `supabase db push`, conferir novamente o historico remoto,
configurar a CLI canonica e validar replay completo em banco novo isolado.
Essa validacao ainda nao ocorreu. Nao reaplique a inicial nem a lista de
espera; `0001_lista_espera.sql` nao pertence ao historico aplicado.
Nenhum SQL desta consolidacao foi reaplicado no servidor.

`supabase/tests/account_backups.sql` testa RLS e concorrencia como postgres
em uma transacao com rollback. Nao modifica usuarios reais. A interface
oferece uma unica copia atual por conta, limite de 5 MB e salvamento manual;
nao representa sincronizacao ao vivo ou backups diarios automaticos.
