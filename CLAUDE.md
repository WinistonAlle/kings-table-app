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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
