# Sincronizacao do dominio

Contrato de implementacao, 16/09/2026. Nao representa recurso entregue.
Referencias de escopo: CHECKLIST.md, especialmente D03, F018/F019 e F082.

## Evidencia atual

- Stores locais persistem torneios completos, presets e relogios por conta.
- Trocas de conta sao serializadas; falha de hidratacao impede liberar a UI.
- AuthGate descarta verificacoes antigas e oculta a conta anterior na troca.
- Supabase consultado em 16/09: tournaments/tournament_players usam UUIDs.
  Novas entidades locais agora usam UUID v4; IDs legados t_*/p_* permanecem
  intactos. Nao enviar esses valores legados para colunas UUID sem mapeamento.
- Identidade web usa crypto.randomUUID; nativo usa expo-crypto 15.0.9
  compativel com SDK 54. Web requer contexto seguro (HTTPS ou localhost).
  Convidados continuam guest_*: nao sao perfis Auth, mesmo quando a inscricao
  tem UUID. Um UUID de inscricao nao comprova vinculo com conta autenticada.
- Identidade dos novos registros validada em testes e criacao real na UI
  web, com reload e capturas 390/1440 inspecionadas. Nativo ainda nao foi
  validado em aparelho. O nucleo local da fila existe. API transacional de
  presets agora existe apenas no banco local; remoto e stores nao integrados.
- As quatro versoes aplicadas estao em packages/db/supabase/migrations;
  inicial reconstruida a partir dos 53 statements do historico remoto.
  Copias antigas preservadas. Replay em banco novo PostgreSQL 17 e reset
  exclusivamente local passaram; configuracao canonica em packages/db.
  Nao equivale a diff completo do schema remoto ou migracao de dados legados.
- tournaments remoto tem current_level/seconds_remaining, mas nao possui
  ancora temporal, revisao ou hand-for-hand. Tambem nao representa campos
  locais de assentos, convidados, acertos e auditoria.
- Policies atuais de tournaments restringem criador/membros; isso nao
  concede permissao de escrita a co-hosts nem cria leitura por QR Code.
- account_backups guarda uma copia manual. Nao e o dominio sincronizado.
- Nenhuma migracao remota ou escrita de dados ocorreu nesta verificacao.
  Para o ambiente local, a versao remota foi consultada: PostgreSQL 17.6.

## Banco Local Reproduzivel

- ID kings-table-local; portas 55320-55329, previews 3001/8081 preservados.
  db start e reset local aplicaram as quatro versoes em banco novo; lista
  de migracoes local conferida. Seeds desligados, nenhum dado remoto copiado.
- packages/db/scripts/test-local.mjs executa SQL em Postgres real pelo
  container fixo local. Nao possui argumento de alvo remoto ou URL de banco.
- Suite com rollback: duas contas, anonimo, tamanho/versao/revisao invalidos
  e reassociacao do dono. Runner cria somente um ator UUID aleatorio para
  duas transacoes concorrentes: espera por lock observada, um commit, outro
  conflito 40001, revisao 2 e conteudo do vencedor preservados.
- Fixtures removidas e teste repetido depois do replay; nenhum login real
  foi usado. Isso nao valida Auth e-mail, HTTP/RLS no navegador, dominio
  sincronizado, idempotencia ou concorrencia das futuras APIs de comandos.
- Comandos e limites descritos em packages/db/README.md. Reset destrutivo
  restrito ao novo ambiente de QA; nao aplicar a banco com dados do usuario.

## Invariantes obrigatorias

1. Servidor confirma identidade e autorizacao em toda operacao. Dono vem
   da identidade autenticada, nunca de createdBy enviado pelo navegador.
2. Cada entidade nova e operacao tem identidade global independente do
   horario do aparelho. Registros legados mantem IDs locais ate migracao
   confirmada, com mapeamento persistido e sem troca silenciosa de referencias.
3. Uma operacao tem ID imutavel, ator, alvo, tipo, payload e revisao esperada.
   Reenvio do mesmo ID/payload devolve o mesmo resultado, sem duplicar efeitos.
   Mesmo ID com outro payload e erro, nunca uma nova operacao.
4. Transacao grava mudanca, revisao, recibo idempotente e auditoria juntos.
   Falha em qualquer parte nao deixa jogadores/financeiro/relogio parciais.
5. Conflito de revisao nao aceita last-write-wins de um torneio inteiro.
   Mudancas compativeis podem ser reaplicadas sobre a versao atual usando
   regras do dominio; conflito financeiro/eliminacao exige revisao explicita.
6. Fila offline e persistida antes do envio, isolada por conta. Trocar de
   conta/logout interrompe envios; resposta antiga nao muda a conta atual.
   Nao descartar operacoes pendentes ao atualizar cache ou restaurar backup.
7. Confirmacao remota remove apenas a operacao correspondente. Timeout
   apos commit reenvia o mesmo ID; nao presume que a escrita foi rejeitada.
8. Realtime informa mudancas, nao e a unica fonte de verdade. Reabrir,
   recuperar conexao ou perder eventos consulta revisoes no servidor.
9. Exclusao usa registro de remocao/revisao antes de qualquer limpeza;
   um dispositivo atrasado nao pode ressuscitar uma mesa excluida.
10. Validacao do dominio acontece no servidor tambem. UI desabilitada e
    validacao Zod no cliente nao substituem integridade e autorizacao.

## API Transacional De Presets (Somente Local)

- Migracao 20260917013930_transactional_blind_presets criada pela CLI,
  aplicada e testada exclusivamente no banco local. As quatro versoes
  anteriores continuam sendo as unicas confirmadas no remoto.
- public.apply_preset_operation(p_operation) recebe envelope v1 da fila,
  suporta preset.save (criar/editar) e preset.remove. Outros comandos nao
  sao substituidos por snapshots nem considerados implementados.
- Validacao independente no servidor: campos exatos, ator Auth/UUID,
  revisao inteira segura, data UTC, payload e limite de 1 MB na representacao
  JSONB. Nome 1-120 caracteres apos normalizacao de espacos; 1-500 linhas,
  sequencia normalizada, duracao 1-240, blinds/ante inteiros seguros,
  big blind positivo, intervalos zerados e pelo menos um nivel de jogo.
  Limites ainda precisam ser alinhados na interface antes de ativar o fluxo.
- blind_structures ganha revision/deleted_at/updated_at sem substituir os
  dados anteriores. Defaults nao podem ser editados pela API. Exclusao
  preserva niveis e referencias; outro comando nao ressuscita ID excluido.
- Escrita direta de clientes revogada e policies de insert/update removidas.
  Wrapper publico security invoker chama implementacao definer em kt_private,
  nao exposto na Data API, com search_path vazio e verificacao explicita de
  auth.uid/owner real. Privilegio limitado e necessario para transacao sem
  liberar escrita direta. Helpers nao tem EXECUTE para clientes/anonimos.
- Locks transacionais separados de operacao (ator+ID) e entidade cobrem
  criacao ausente e retries concorrentes. Recibo compara envelope JSONB
  completo; mudanca de conteudo com mesmo ID e 22023. Conflito de revisao
  e 40001; acesso negado 42501; entidade removida 55000.
- Mudanca, revisao, sync_operation_receipts e sync_operation_audit gravados
  juntos. Leitura restrita ao ator por RLS; sem writes de clientes. Retry
  devolve o recibo original, mesmo apos operacoes posteriores/remocao.
- SQL real: validacao, duas contas, anonimo, actor spoof, defaults, tombstone,
  grant de escrita negado, falha forcada de auditoria com rollback. Duas
  conexoes: mesmo ID concorrente gera um recibo/auditoria; IDs diferentes
  disputando revisao geram um commit e 40001, sem efeitos do perdedor.
- Isso NAO valida login HTTP/e-mail, transporte na UI, offline end-to-end,
  co-hosts, multimesa, relogio ou migracao de IDs legados. Nenhuma migracao
  remota aplicada e nenhum store atual ativado nesse contrato.

## Relogio compartilhado

- Estado autoritativo por torneio: estrutura versionada, nivel, estado
  rodando/pausado/congelado, tempo pausado, ancora de fim e revisao.
- Comandos start/pause/retomar/saltar/congelar usam transacao e hora do
  servidor. Ticks de renderizacao nao fazem escritas por segundo.
- Clientes estimam diferenca de horario com o servidor, recalculam ao
  reconectar e exibem perda de conexao. TV e jogadores nao criam um segundo
  relogio autoritativo nem avancam a estrutura por conta propria.
- Comandos offline pendentes sao visiveis como pendentes; nao apresentar
  como confirmado um controle que as outras telas ainda nao receberam.
- Hand-for-hand completo inclui coordenacao das rodadas multimesa, nao
  apenas a pausa local que existe hoje.

## Nucleo Local Da Fila

- sync-operation.ts define envelope v1, UUIDs, revisao esperada, 26 tipos
  de comando e payload JSON limitado a 1 MB. Isso valida o protocolo,
  nao as regras de cada comando; validacao de dominio no servidor pendente.
- ownerId no envelope e o escopo da conta/ator local, nao autorizacao de
  dono da entidade. Servidor deve verificar esse ator pela sessao e resolver
  dono/co-host do alvo pelas tabelas de acesso, sem confiar no payload.
- sync-outbox.ts usa idb 8.0.3 e IndexedDB, com transacoes readwrite de
  durabilidade strict. Fila e sequencia sao gravadas atomicamente; falha
  de escrita faz rollback dos dois. Nao usar localStorage como fila multiaba.
- ID/conteudo permanecem imutaveis. JSON com outra ordem de chaves e
  equivalente; ID repetido com outro conteudo e recusado. Confirmados
  ficam como recibos locais e nao ressuscitam no reenfileiramento.
- Reserva temporaria de envio (lease) tem token e validade. Duas abas
  nao reservam a mesma entidade simultaneamente; lease expirada permite
  reenvio do mesmo ID. Resposta de token antigo nao altera a reserva atual.
- FIFO por entidade: conflito/rejeicao bloqueia os comandos seguintes
  dessa entidade, sem bloquear outra mesa. Confirmacao exige operationId
  correto e revisao esperada + 1. Reenvio nao altera revisao/payload.
- sync-sender.ts fornece processamento cancelavel para um ownerId fixo.
  stop aborta o sinal e ignora resposta posterior; run concorrente compartilha
  o processamento. Erro de transporte preserva operacao e encerra a rodada,
  sem loop de tentativas. Abortar nao prova que o servidor deixou de gravar.
- IndexedDB simulado nos unitarios: concorrencia, quota/rollback, isolamento,
  deduplicacao, recibo errado, conflitos, retry, reabertura e cancelamento.
- Chrome com IndexedDB real e duas abas: reserva atomica, FIFO, lease
  expirada, resposta antiga, conta B isolada, reload e conflito preservado.
  Fixture qa-outbox-* removida; nenhum usuario/dado remoto foi criado.
- browser-outbox-code.js guarda o fluxo de QA para Playwright CLI. Compilar
  sync-outbox.ts/sync-operation.ts com esbuild para ESM e servir os dois
  bundles por HTTP local com CORS para localhost:8081; passar a URL base
  para a funcao em uma sessao nova do navegador. Servidor apenas temporario.
- O nucleo nao esta ativado na interface. Nenhuma acao atual dos stores
  foi convertida em comando, nenhum envio Supabase e feito e AuthGate ainda
  nao possui o lifecycle do sender. Nao anunciar sincronizacao disponivel.
- Pendencias: API atomica/idempotente, validacao de dominio, autorizacao,
  mapeamento legado, integracao cache/stores/Auth, recuperacao por revisoes,
  backoff e estados visuais, resolucao explicita de conflitos, retencao de
  recibos e restauracao de backup com operacoes pendentes. Nativo depois.

Referencias de implementacao e testes:
https://github.com/jakearchibald/idb
https://github.com/dumbmatter/fakeIndexedDB

## Permissoes e projecoes

- Dono gerencia a noite e os acessos; co-host tem permissao explicita por
  noite. Participante ve apenas os dados permitidos da propria inscricao.
- TV/espectador recebem uma projecao somente leitura. QR Code publico nao
  deve expor contatos, comprovantes, acertos privados ou auditoria interna.
- Links de acesso sao revogaveis e nao equivalem a service_role. Nao usar
  user_metadata para conceder privilegios ou autorizar escrita.
- Escrita que exige revisao/auditoria passa pelo contrato transacional;
  grants de escrita direta nao podem permitir contornar esse contrato.

## Transporte De Presets E HTTP Local

- sync-preset-transport.ts usa RPC tipada/abortSignal do SDK, sem importar
  o singleton de producao nem ativar envios automaticamente. Factory recebe
  client e conta fixos; rejeita envelope invalido, outra conta e comandos
  nao preset antes de enviar. AuthGate/stores ainda nao o instanciam.
- Recibo estrito exige ID correspondente e revisao esperada + 1. Resposta
  ausente, malformada ou divergente e retry, nunca confirmacao nem descarte.
  40001 vira conflito; validacao, acesso negado e tombstone viram rejeicao;
  sessao expirada, servidor indisponivel ou RPC nao instalada preservam retry.
  Mensagens internas do servidor nao sao repassadas para a interface.
- Abort antes/depois do envio nao confirma nem presume rollback remoto.
  SDK com HTTP simulado cobre erros, escopo e resposta tardia apos abort.
- teste-sync-preset-http-local.ts usa somente http://127.0.0.1:55321 e
  credenciais efemeras obtidas da CLI local. Cadastro e login por senha de
  duas contas reais no GoTrue local, com JWT real e requests ao PostgREST.
  Confirma isolamento de leitura, escrita direta negada, actor spoof negado,
  duplicacao concorrente, conflito e perda da resposta apos commit real.
- Nesse teste, sender/outbox juntos recuperam o recibo do mesmo ID e ficam
  confirmados sem duplicar revisao/auditoria. IndexedDB e simulado nessa
  combinacao; navegador com IndexedDB real foi testado separadamente.
- Auth local esta com confirmacao de e-mail desabilitada. O teste NAO prova
  SMTP, confirmacao de e-mail, redirects, renovacao de sessao, logout da UI,
  login no remoto ou sincronizacao de stores. Nao altera configuracoes do app.
- Chave service_role local e usada apenas no runner Node para limpar fixtures,
  nunca enviada ao browser, salva em arquivo ou incluida no app. Contas e
  preset aleatorios removidos no finally, banco local conferido vazio.
- 18 suites offline, TypeScript e export web; teste HTTP local separado.
  Comandos de reproducao em packages/db/README.md. Integracao com UI, cache,
  lifecycle Auth, reconciliacao e regras do dominio restante continuam pendentes.

Referencia: https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal

## Sequencia de implementacao

1. Consolidar historico local/remoto das migracoes e criar identidade global
   para novas entidades/operacoes, sem modificar dados existentes.
2. Estender modelo normalizado para representar todos os campos locais;
   criar recibos, revisoes, tombstones e regras transacionais de permissao.
3. Integrar fila/cache por conta aos comandos reais dos stores. Migrar dados
   locais explicitamente, com copia anterior, mapeamento e retomada idempotente.
4. Integrar leitura inicial, comandos, reconciliacao e Realtime. Implementar
   estados de enviando, offline, erro de permissao e conflito na interface.
5. Integrar relogio autoritativo e modo TV remoto; depois projecoes QR/RSVP.
   Presets e demais entidades tambem entram no contrato, nao so torneios.

## Portas de validacao

- Unitarios: regras/reaplicacao, fila persistida, troca de conta, timeouts,
  payload duplicado, conflitos e referencias legadas.
- Banco: RLS allow/deny para anon/dono/co-host/participante/estranho;
  recibos e auditoria atomicos; concorrencia real de duas transacoes.
- Navegador: duas contas reais, dois dispositivos da mesma noite, login,
  renovacao, logout, offline/reload/reconexao e conflito financeiro.
- Relogio: diferenca de hora entre aparelhos, pausa/salto/congelamento,
  intervalos, TV somente leitura e recuperacao apos suspensao.
- Simulacao de Auth comprova comportamento da UI, nao valida e-mail, JWT,
  redirects, SMTP ou isolamento end-to-end de contas reais.
- Nenhum gate amplo vira validado por export/build ou consulta administrativa.

Referencia de seguranca: https://supabase.com/docs/guides/database/postgres/row-level-security
Callback Auth permanece sincrono, com verificacao agendada fora dele:
https://supabase.com/docs/guides/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0
