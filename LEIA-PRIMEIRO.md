## ⚠️ PRIMEIRA COISA AO VOLTAR: Supabase pra nuvem

Em 14/10/2026 o Supabase local deste projeto foi desligado (Colima parado) porque
estava travando em loop e esquentando o Mac. Decisão do usuário: este projeto vai
para o **Supabase na nuvem**. Antes de qualquer outra tarefa aqui:

1. Criar (ou escolher) o projeto no Supabase na nuvem.
2. Aplicar as migrations de `packages/db/supabase/migrations` no banco da nuvem.
3. Trocar URL e chaves no `.env` / variáveis da Vercel para as da nuvem.
4. Se precisar dos dados locais antigos: `colima start` e `supabase start` só
   para exportar, e depois `supabase stop` + `colima stop` de novo.
5. Quando terminar, apagar este aviso (aqui e no `LEIA-PRIMEIRO.md`).

Não volte a usar o Supabase local neste projeto.

