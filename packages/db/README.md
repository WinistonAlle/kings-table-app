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

Novas migracoes estao em `supabase/migrations/`, criadas com a CLI e
renomeadas para a versao registrada pelo MCP no servidor. A migracao inicial
continua em `migrations/`; antes de usar `supabase db push`, consolide o
historico local com o remoto. Nao reaplique a inicial nem a lista de espera.

`supabase/tests/account_backups.sql` testa RLS e concorrencia como postgres
em uma transacao com rollback. Nao modifica usuarios reais. A interface
oferece uma unica copia atual por conta, limite de 5 MB e salvamento manual;
nao representa sincronizacao ao vivo ou backups diarios automaticos.
