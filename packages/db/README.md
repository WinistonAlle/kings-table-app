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
