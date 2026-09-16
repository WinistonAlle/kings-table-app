# @kings-table/core

Regra de negócio pura, compartilhada entre o app e o site.

**Ainda vazio.** O conteúdo vem de `apps/app/lib/`: `payouts.ts`,
`standings.ts`, `timer.ts` e `torneio.ts`, que já são módulos puros e rodam
em node (é por isso que as oito suítes em `apps/app/testes/` funcionam sem
simulador).

A mudança foi deixada de fora da etapa de unificação de propósito: mover os
módulos e religar os imports altera o app, e misturar isso com mudança de
estrutura tornaria impossível saber o que quebrou o quê.
