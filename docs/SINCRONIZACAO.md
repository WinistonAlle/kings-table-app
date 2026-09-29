# Sincronizacao do dominio

Contrato de implementacao, 16/09/2026. Nao representa recurso entregue.
Referencias de escopo: CHECKLIST.md, especialmente D03, F018/F019 e F082.

## Correcao de nome de jogador em 29/09/2026

- `player.update` aceita somente `playerId` e `name` nesta etapa. O servidor
  normaliza espacos externos, exige 1-60 caracteres e recusa nome duplicado
  na mesma mesa, jogador ausente, noite cancelada ou revisao obsoleta. Pode
  corrigir um nome apos o encerramento sem alterar identidade, entradas,
  pagamento ou resultado. Outros campos enviados no payload sao rejeitados.
- A transacao grava nome, revisao da mesa, recibo e auditoria juntos. Postgres
  local passou validacao, acesso de outra conta negado, escrita direta negada,
  falha forcada da auditoria com rollback e disputa real em duas conexoes.
  Auth/HTTP local passou leitura, isolamento e reenvio apos perda de resposta
  sem segunda alteracao. Fixtures temporarias foram removidas.
- O contrato e o transporte existem somente no ambiente local de QA; a tela
  ainda usa o store local e nao envia esta operacao. Apelido, avatar, contato,
  vinculo a perfil e demais campos de `player.update` continuam pendentes.

## Relogio compartilhado em 29/09/2026

- O servidor guarda `clock_ends_at` separado de `updated_at`: entradas e
  pagamentos nao movem o relogio. `read_tournament_clock` usa a hora do banco
  para calcular nivel, segundos restantes, fim do nivel e hand-for-hand,
  devolvendo tambem `serverNow` e revisao. O leitor exige a conta organizadora.
  Os campos brutos da mesa nao substituem essa leitura enquanto o tempo corre.
- `tournament.start` inicia a noite com o relogio pausado. `clock.start`,
  `clock.pause`, `clock.level`, `clock.reset` e `clock.handForHand` exigem
  revisao atual e gravam estado, recibo e auditoria na mesma transacao. Um ID
  reenviado devolve o mesmo recibo; duas operacoes concorrentes com a mesma
  revisao nao alteram o relogio duas vezes. Hand-for-hand congela o tempo;
  desativar o modo deixa o relogio pausado ate novo start.
- SQL local cobriu progressao, expiracao, pausa, isolamento, payloads invalidos,
  rollback e corridas em duas conexoes. Auth/HTTP local cobriu duas contas,
  escrita direta negada e resposta perdida apos commit. Leitor e transporte
  passaram testes de HTTP simulado; suite do app, tipos, export web e advisor
  de seguranca local passaram.
- Migracao aplicada apenas no Supabase local. Transporte e leitura ainda nao
  estao ligados ao store/tela; nao ha Realtime, controle remoto, reconciliacao
  offline nem implantacao remota. Portanto, F019 ainda nao esta entregue ao
  usuario: dois aparelhos com a UI atual nao compartilham esse relogio.

## Reentradas e add-ons em 29/09/2026

- `player.entries.adjust` recebe tipo, delta de uma unidade e total esperado em
  centavos. A transacao valida revisao, propriedade, limite de reentradas,
  total, estado da mesa e jogador; grava contador, marcador financeiro,
  evento de entrada, recibo e auditoria juntos. Add-ons seguem o valor do
  buy-in atual, como no app local. Reentrada desativada ou acima do limite e
  recusada.
- Acrescentar valor a uma entrada confirmada volta o estado do jogador a
  pendente e registra a transicao. Reducoes sao correcoes permitidas somente
  em estado pendente e sem comprovante; entradas confirmadas ou contestadas
  nao sao reduzidas. A retirada consulta os eventos de entrada mesmo quando
  o marcador financeiro esta incorreto.
- Postgres local passou validacao, limites, isolamento, rollback por falha de
  auditoria, reenvio idempotente e corridas entre duas conexoes. Auth/HTTP
  local passou duas contas, bloqueio de escrita direta, cancelamento de uma
  reentrada e resposta perdida apos commit sem duplicar add-on. Tipos, suite
  do app, export web e verificador de seguranca local passaram.
- Nao ha valor proprio por add-on, pagamento parcial, estorno financeiro nem
  conciliacao com comprovantes. O transporte nao esta ligado ao store/tela e
  a migracao foi aplicada somente no Supabase local, sem deploy remoto.

## Leitura de mesa em 29/09/2026

- O leitor recebe a conta e o ID da mesa, consulta somente esse escopo,
  percorre jogadores por ID e confere a revisao antes e depois. Mudanca durante
  a leitura causa ate tres tentativas; uma resposta invalida ou incompleta e
  recusada sem retornar um snapshot parcial. Ausencia nao e interpretada como
  exclusao de dados locais.
- Testes HTTP simulados cobrem paginas curtas, erro em pagina posterior,
  isolamento, revisao mutavel, resposta invalida e cancelamento tardio.
  Auth/HTTP local com duas contas confirmou a leitura da mesa com pagamento
  revertido, marcador financeiro e invisibilidade para outra conta. Tipos,
  suite do app e export web passaram; fixtures foram removidas.
- Isto ainda nao e reconciliacao: o leitor nao mescla dados, nao acompanha
  mudancas via Realtime e nao grava no store local. A interface continua local
  enquanto faltam comandos online do dominio e migracao das noites existentes.

## Estado de pagamento em 29/09/2026

- `player.payment.set` altera o estado financeiro do jogador inteiro entre
  pendente, confirmado e contestado. Exige valor esperado em centavos, revisao
  atual, conta organizadora e estado diferente do anterior. A transacao grava
  marcador de atividade financeira, evento imutavel, revisao, recibo e auditoria.
  Retornar a pendente nao autoriza apagar a entrada nem apaga o historico.
- Postgres local passou payloads invalidos, revisao e valor obsoletos,
  rollback, isolamento, reenvio idempotente e corrida de duas conexoes. Auth/HTTP
  local passou duas contas, RLS dos eventos, escrita direta negada, reversao e
  resposta perdida apos commit com reenvio pelo mesmo ID. Tipos e suite do app
  passaram. Fixtures foram removidas.
- O transporte aceita o comando, mas a UI ainda usa o fluxo local. Nao ha
  pagamentos parciais, valor efetivamente recebido por evento, reconciliacao
  com comprovantes nem migracao de historico local. A migracao foi aplicada
  somente no Supabase local; producao e ativacao para usuarios pendentes.

## Retirada de entrada em 25/09/2026

- `player.remove` aceita somente uma entrada pendente, sem reentrada,
  add-on, resultado ou comprovante, enquanto a mesa ainda esta em preparacao.
  Um lock na linha do jogador serializa a checagem de comprovantes com
  insercoes concorrentes que usam a chave estrangeira. O comando remove o
  jogador, incrementa a revisao e grava recibo/auditoria atomicamente.
- Postgres local passou payload invalido, idempotencia, conta alheia,
  bloqueios de comprovante/pagamento/noite iniciada, falha forcada de
  auditoria com rollback e concorrencia entre duas conexoes. Auth/HTTP local
  passou duas contas, escrita direta negada e resposta perdida apos commit
  com reenvio pelo mesmo ID; fixtures foram removidas. Suite do app e tipos
  passaram. A interface continua com a retirada local.
- A migracao existe apenas no banco local. O banco nao tem ainda convites
  ou acertos sincronizados; a garantia financeira online so cobre o estado,
  eventos e comprovantes que estao efetivamente no banco. Integracao a UI,
  reconciliacao e Supabase remoto
  continuam pendentes.

## Primeira entrada de jogador em 24/09/2026

- `player.add` recebe ID estavel e nome para um convidado sem conta vinculada.
  A mesa precisa estar em preparacao ou andamento e na revisao esperada. O
  servidor rejeita nome vazio, repetido na mesma mesa, ID invalido e vaga
  esgotada. A entrada grava um buy-in com pagamento pendente, incrementa a
  revisao da mesa e registra recibo/auditoria na mesma transacao.
- Escrita direta em `tournament_players` foi retirada do navegador; leitura
  autenticada continua sujeita ao RLS existente. Postgres local passou
  validacao, isolamento, rollback por falha de auditoria e corrida real pela
  ultima vaga. Auth/HTTP local com duas contas passou bloqueio de escrita
  direta, capacidade, nomes duplicados e reenvio apos resposta perdida depois
  do commit sem jogador duplicado. Fixtures dos testes foram removidas.
- A UI ainda usa o fluxo local. `player.update` existe apenas para corrigir o
  nome; eliminacao e vinculacao a perfil ainda nao existem nesse contrato
  online. Reentrada e add-on ja tem comandos transacionais, mas nao estao
  integrados a tela. Convites confirmados
  ainda nao estao no banco, portanto a
  capacidade online so conta entradas registradas. Migracao so no banco local;
  a sincronizacao de mesas segue desativada para o usuario.

## Edicao de agendamento em 24/09/2026

- `tournament.update` aceita somente data futura, local e capacidade da mesa
  enquanto ela esta em preparacao. Exige a revisao atual, preserva naipe e cor,
  recusa capacidade menor que o numero de jogadores ja registrados no banco
  e grava alteracao, recibo e auditoria na mesma transacao. Local vazio e
  capacidade nula removem os respectivos detalhes. Nao muda buy-in, blinds,
  status, jogadores, relogio nem pagamentos.
- Postgres local passou teste de campos invalidos, conta errada, mesa iniciada,
  escrita direta negada, rollback por falha de auditoria e corrida de duas
  conexoes. Auth/HTTP local passou leitura e edicao com duas contas, revisao
  obsoleta e resposta perdida apos commit, reconciliada com o mesmo ID.
- Ainda nao esta ligado a tela. O banco nao conhece convites locais, portanto
  so consegue validar a capacidade contra jogadores persistidos nele; o
  invariante completo de reservas depende dos futuros comandos de convidados.
  Migracao e testes continuam apenas locais, sem deploy no Supabase remoto.

## Primeiro comando de mesa em 24/09/2026

- `tournament.create` agora tem uma transacao no Supabase LOCAL: valida nome,
  formato, buy-in em centavos, reentradas, horario, niveis e intervalos;
  grava mesa, revisao 1, recibo idempotente e auditoria juntos. A conta
  autenticada deve coincidir com a dona do comando. Leitura e isolada por RLS;
  escrita direta de tabelas pelo navegador e negada.
- Na etapa inicial, o transporte aceitava apenas esse comando para uma conta fixa. Testes
  cobrem recibo incorreto, conflito, erro de rede e abort. Postgres local
  passou validacao/rollback e corridas de duas conexoes; Auth/HTTP local com
  duas contas passou isolamento, escrita negada e reenvio apos resposta perdida
  depois de commit real. O runner HTTP usa IndexedDB simulado e remove suas
  fixtures no fim.
- Esta e uma fundacao, nao uma mesa sincronizada entregue: o transporte nao
  esta ligado ao fluxo de criacao da interface. Faltam a maior parte dos
  comandos de torneio e jogadores, relogio, ligas, migracao de dados locais, reconciliacao
  e validacao no navegador com o dominio inteiro. A migracao nova existe
  somente no banco local; nenhum `db push` foi feito e a flag de presets
  permanece desligada por padrao.

## Falha De Gravacao Da Decisao Em 23/09/2026

- Chrome em localhost:3302, com Auth/HTTP do Supabase local e IndexedDB
  reais. A conta A tentou copiar uma alteracao recusada com 42501 sobre uma
  estrutura privada da conta B. O teste injetou QuotaExceededError no put que
  arquivaria a operacao original, depois do inicio da criacao da copia, dentro
  da mesma transacao.
- A interface exibiu uma mensagem de espaco insuficiente e manteve a revisao
  aberta. O IndexedDB conservou a operacao original como rejeitada: uma
  pendencia, zero arquivadas, nenhuma copia parcial. Sem a falha injetada,
  repetir a decisao arquivou a intencao uma vez e confirmou uma unica copia
  nova na revisao 1. A estrutura B permaneceu na revisao 1 e a copia pertence
  apenas a A. Reload manteve copia e historico.
- Captura `output/playwright/preset-write-failure-mobile.png` inspecionada em
  390x844, sem overflow. IndexedDB, contas e estruturas desta rodada foram
  removidos. Isto demonstra rollback e retry no navegador, nao esgotamento
  fisico da cota. Outras falhas de gravacao, navegadores e Supabase remoto
  continuam sem validacao. Flag padrao permanece desligada.

## Criacao Recusada Em 23/09/2026

- Chrome em localhost:3302, com duas contas reais no Supabase local. A conta B
  criou uma estrutura privada na revisao 1; a conta A tentou salvar uma
  estrutura local com o mesmo ID e recebeu 42501. A consulta autenticada da
  conta A nao retornou a estrutura B.
- A interface mostrou a tentativa recusada sem inventar uma versao confirmada
  da conta. A conta A salvou sua intencao como nova estrutura, com outro ID e
  revisao 1. Uma segunda tentativa recusada contra o ID privado foi arquivada.
  Ao final, havia zero operacoes pendentes, duas decisoes arquivadas no ID
  original e a copia confirmada na conta A; a consulta da conta A retornou
  apenas a copia propria.
- Para linhas sem versao confirmada, a acao de arquivar e o historico usam
  termos especificos, e nao aparece um botao de exclusao sem efeito. Reload
  manteve a copia e o historico. Captura
  `output/playwright/preset-rejected-mobile.png` inspecionada em 390x844,
  sem overflow. IndexedDB e fixtures desta rodada foram removidos.
- Ainda faltam outras falhas de gravacao/concorrencia durante a decisao,
  outros navegadores e validacao no Supabase remoto. A flag continua desligada no
  build padrao; este ensaio nao habilitou sincronizacao em producao.

## Revisao Entre Abas Em 23/09/2026

- Chrome em origem isolada localhost:3302, com login real no Supabase local:
  uma exclusao pendente disputou uma edicao remota e recebeu 40001. Cancelar
  a confirmacao de "Manter versao da conta" deixou a pendencia em conflito,
  sem historico novo nem alteracao da revisao remota 2.
- Em novo conflito da mesma estrutura, a segunda aba confirmou a decisao na
  interface. A primeira permaneceu com uma revisao antiga; o teste acionou
  seu handler de decisao por DOM em segundo plano com confirmacao aceita.
  O nucleo recusou a decisao desatualizada, sem duplicar o historico. Ao
  atualizar, a tela passou a mostrar a versao confirmada e removeu o erro
  antigo. O componente agora limpa erros de decisao quando a revisao/fila
  muda e fecha a revisao quando nao existe mais conflito.
- O banco manteve a estrutura ativa na revisao 3; as duas intencoes desta
  rodada ficaram arquivadas uma vez cada e sem pendencias. Captura mobile
  `output/playwright/preset-conflict-history-mobile.png` inspecionada em
  390x844, sem overflow. IndexedDB da origem QA e fixtures da rodada foram
  removidos; consulta posterior encontrou 0 contas e 0 estruturas do nonce.
- Ainda faltam falha de gravacao/concorrencia durante a transacao da decisao
  e validacao em Supabase remoto. O segundo acionamento
  de decisao usou clique DOM de QA para manter a aba antiga sem receber foco;
  nao representa um gesto manual comum do usuario.

## Bloqueio Do Armazenamento Em 23/09/2026

- A abertura do IndexedDB v3 agora espera ate 5 s apenas quando outra aba
  bloqueia o upgrade. Depois mostra erro recuperavel; se a abertura antiga
  concluir tarde, a conexao e fechada. Ao tocar em Atualizar estruturas apos
  erro local, o provider cria outra sessao, em vez de reutilizar a conexao
  rejeitada. Nenhum comando da fila e apagado nesse caminho.
- Chrome em localhost:3302 com Auth local real: uma aba manteve conexao v2
  aberta e recusou versionchange; a aba do app exibiu erro em vez de esperar
  indefinidamente. Ao fechar a conexao v2, um unico retry abriu v3 e carregou
  a biblioteca vazia da conta sem reload. Outro ensaio injetou SecurityError
  em indexedDB.open; o mesmo retry recuperou apos restaurar a API. Erro e
  recuperacao conferidos em 390x844, sem overflow horizontal; captura
  `output/playwright/preset-storage-blocked-mobile.png` inspecionada.
- A injecao de SecurityError nao e uma configuracao real de permissao do
  navegador. A base v2 e as contas eram fixtures da origem/banco local de QA,
  removidas ao final. teste-sync-outbox.ts tambem cobre timeout e reabertura
  com IndexedDB simulado. Nao valida quota, Safari, producao ou offline integral.

## Revisao Na Interface Em 22/09/2026

- PresetSyncProvider e a biblioteca da conta oferecem duas decisoes explicitas:
  manter a versao da conta ou salvar uma copia com nome proprio. A revisao
  compara nome, niveis e intervalos; pede confirmacao e exibe o historico
  arquivado. A decisao so fica disponivel depois de resposta definitiva e
  leitura remota concluida. Erros de armazenamento ou mudancas em outra aba
  preservam a fila e pedem nova revisao.
- Em origem isolada localhost:3302, Chrome usou login por senha e cookie
  compartilhado entre landing e app. Duas estruturas foram criadas via HTTP;
  exclusoes locais disputaram atualizacoes remotas rev1 -> rev2 e receberam
  conflito 40001. A UI manteve a primeira versao da conta e criou copia da
  segunda em novo UUID/rev1. Depois de reload, ambas tinham historico e
  nenhuma pendencia; a conta B mostrou biblioteca vazia. Capturas da revisao
  em 390x844 e 1440x900 foram inspecionadas, sem overflow horizontal.
- Este teste cobre o backend Supabase LOCAL com Auth/HTTP/IndexedDB reais. A
  quinta migracao segue apenas local e a flag permanece desligada por padrao.
  Ainda faltam: confirmacao cancelada e erro de decisao na UI, concorrencia
  de duas abas na interface, criacao rejeitada, refresh de sessao, migracao
  v2 real em browser, remoto de producao e restante do dominio sincronizado.
  Fixtures desta rodada removidas da origem QA e do banco local (0 usuarios
  e 0 presets para o nonce da rodada); outros dados nao foram apagados.

## Nucleo De Revisao Em 17/09/2026

- resolvePreset permite manter a base da conta ou salvar a ultima intencao
  de estrutura como copia independente. Exige primeira pendencia com rejeicao
  definitiva (conflict/rejected); queued, sending e resultado desconhecido
  nunca autorizam cancelar o comando. Timeout nao comprova rollback remoto.
- A transacao compara a base completa e a lista ordenada de IDs pendentes
  apresentados na revisao. Outra aba alterando base/fila invalida a decisao.
  Copia recebe UUID novo e revisao esperada zero; original nunca e sobrescrito
  ou ressuscitado. Exclusao conflitante pode manter o tombstone original.
- Intencoes ficam em estado terminal cancelled, com envelope, tentativas e
  motivo preservados. resolution registra ID/data/decisao e liga a copia ao
  seu comando. projectPreset expoe archived separado de pending; reenfileirar
  o mesmo ID nao ressuscita a operacao. Nao ha exclusao de historico.
- Reserva de sequencia, novo comando e arquivo da cadeia usam uma transacao
  IndexedDB com durabilidade strict. Quota, validacao ou abort revertem tudo.
  PresetSyncSession.resolve exige biblioteca ready e respeita stop/abort.
  A integracao de interface chegou na etapa de 22/09 acima.
- Banco local passa a v3 sem remover stores/registros. A versao protege os
  novos estados de clientes antigos: conexoes atuais fecham em versionchange;
  clientes v2 nao reabrem v3 (VersionError). UX de atualizacao de abas antigas
  e validacao especifica da migracao v2 real ainda precisam ser conferidas.
- Evidencias: 22 suites, TypeScript e export web passaram. Suite de resolucao
  usa IndexedDB simulado: resposta incerta, snapshot, rollback/quota/abort,
  corrida, isolamento, tombstone, criacao rejeitada e reopen. Runner
  browser-preset-resolution-code.js passou em Chrome com IndexedDB real e
  duas conexoes concorrentes, copia unica, arquivo, isolamento e reopen;
  conflitos/recibos desse runner sao fixtures locais, nao Auth/HTTP reais.
- O nucleo desta etapa precedeu a UI e a prova Auth/HTTP real descritas acima.
  O fluxo completo de sincronizacao permanece em andamento.

## Integracao Web Em 17/09/2026

- PresetSyncProvider conecta o coordenador ao AuthGate para uma conta
  verificada. key por UUID; logout, troca de conta, falha de verificacao e
  cleanup interrompem o coordenador imediatamente. Cleanup espera waitForIdle
  antes de fechar IndexedDB; nenhuma resposta antiga publica a conta atual.
- Ativacao controlada: EXPO_PUBLIC_PRESET_SYNC_ENABLED=1, desativada por
  padrao. API da quinta migracao continua somente LOCAL; nao habilitar no
  remoto antes de instalar/verificar o contrato. Nativo e modo teste continuam
  exclusivamente locais. Nenhuma .env existente alterada nesta etapa.
- Criar mesa exibe biblioteca da conta com carregamento, vazio, erro,
  pendencia, confirmacao, exclusao pendente e conflito. Salvar pelo editor
  enfileira antes do envio; usar copia os niveis para o formulario. Exclusao
  pede confirmacao e preserva estruturas copiadas em mesas existentes.
  Presets locais anteriores ficam separados e intactos, sem migracao automatica.
- Eventos online/focus solicitam recuperacao. synchronize(true) registra
  uma rodada adicional quando um evento chega durante uma tentativa antiga,
  inclusive se ela falhar. Novas mutacoes durante pull tambem pedem nova rodada;
  nao existe loop de retries sem novos eventos/acoes. Backoff/lease timer e
  Realtime ainda pendentes; a UI nao chama fase ready de sincronizacao completa.
- QA usou export real do app em origem temporaria localhost:65081, com
  flag ligada e API 127.0.0.1:55321; previews 3001/8081 preservados. Compile
  com --clear ao trocar variaveis: export inicial reutilizou transform antigo;
  URL no bundle conferida antes dos testes. Export padrao refeito ao finalizar.
- Chrome com GoTrue/JWT/PostgREST/IndexedDB reais e AuthGate: login por senha
  via SDK de QA, salvar pela UI, pendencia offline visivel, retomada por online,
  reload online e uso no editor. Outra sessao alterou revisao; exclusao antiga
  gerou conflito visivel e uso bloqueado, sem sobrescrita. Cancelar exclusao
  preservou item; aceitar confirmou tombstone revisao 2 no servidor.
- Login da conta B seguido de reload exibiu biblioteca vazia, sem dados de A.
  Sair da conta pela UI redirecionou para login. Nao prova tela de login local,
  cadastro/e-mail/SMTP, refresh de sessao, troca sem reload ou Auth remoto.
  Erros HTTP esperados foram observados ao ficar offline/gerar conflito;
  helpers SDK duplicados de QA produziram aviso, nao afirmar console zerado.
- Capturas preset-library-mobile.png (390) e preset-library-desktop.png
  (1440) inspecionadas em output/playwright, sem overflow horizontal. Cache
  removido apenas na origem isolada de QA; contas/presets/recibos/auditoria
  de fixtures removidos pelo helper Node. Nenhum dado/configuracao remoto alterado.
- Falha de abertura do IndexedDB tem estado de erro e retry via
  Atualizar estruturas; o ensaio de 23/09 acima cobre negacao injetada e
  bloqueio real de upgrade entre abas.
  Migracao legado, edicao/duplicacao na conta, protecao/backup da fila e
  recuperacao do app inteiro offline ainda pendentes. Revisao de conflitos
  esta descrita nas etapas posteriores deste documento.

As secoes de nucleo abaixo registram verificacoes incrementais anteriores;
esta secao descreve a integracao atual e seus limites de ativacao.

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
- Interface de presets tem integracao sob flag, descrita acima. Stores de
  torneios continuam locais e nao produzem comandos. Nao anunciar o dominio
  inteiro sincronizado ou disponibilidade remota.
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
  nao preset antes de enviar. Provider web o instancia somente sob flag.
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
- 19 suites offline, TypeScript e export web; teste HTTP local separado.
  Comandos de reproducao em packages/db/README.md. Integracao com UI, cache,
  lifecycle Auth, reconciliacao e regras do dominio restante continuam pendentes.

## Cache Transacional De Presets

- IndexedDB v2 adiciona bases confirmadas por conta/entidade e indice da
  fila por entidade, sem apagar a fila ou a sequencia da versao anterior.
  Os stores atuais continuam usando seu caminho anterior; cache nao ativado na UI.
- mutatePreset normaliza e valida nome/estrutura antes de enfileirar. A
  leitura da base, projecao pendente, reserva da revisao e gravacao do comando
  usam uma unica transacao. Duas abas criam revisoes consecutivas, nao iguais.
  Nome limitado a 120 pontos de codigo, alinhado ao char_length do Postgres.
- presetView distingue confirmed, projected, pending e reconciliationNeeded.
  Conflito, rejeicao ou revisao divergente preservam a intencao e bloqueiam
  novos comandos da entidade; nao rebaseiam nem descartam dados silenciosamente.
- presetViews le a biblioteca inteira de uma conta em uma transacao readonly
  sobre bases e fila. Inclui criacoes pendentes, tombstones e conflitos;
  leitura nao filtra exclusoes nem descarta intencoes. A interface deve decidir
  como apresentar esses estados, sem tratar uma remocao pendente como confirmada.
  Consulta bases pelo intervalo da chave composta e comandos pelo indice owner.
- browser-preset-library-code.js validou essa leitura no IndexedDB real do
  Chrome: duas conexoes, mesmo ID em contas diferentes, criacao/remocao pendentes
  e reopen. Fixture qa-preset-library-* removida no finally. Usa o mesmo bundle
  ESM de browser-preset-sync-entry.ts e runner(page, bundleUrl), sem servidor
  Supabase ou escrita remota. Recibo desse teste e local, nao prova HTTP/Auth.
- Confirmacao grava base e recibo local juntos. Falha de quota faz rollback
  dos dois. Pull atrasado nao substitui base nova; mesma revisao com conteudo
  diferente e erro. Tombstone nao permite ressuscitar o mesmo ID.
- teste-sync-preset-cache.ts cobre upgrade v1, duas conexoes, isolamento,
  normalizacao, quota forcada, conflito, tombstones e reabertura. Chrome real
  com Auth/HTTP local confirmou base na revisao 3, sem pendencias, e preservou
  projecao offline apos reload online. Nao valida telas ou reload sem rede.
- Integracao aos stores/AuthGate, leitura inicial do servidor, Realtime,
  revisao explicita de conflitos e protecao de restore/IDs legados pendentes.
  API permanece somente local; nenhuma migracao remota aplicada.

Referencia: https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal

## Verificacao Conjunta No Chrome

- browser-preset-sync-entry.ts expoe somente o kit do cliente. Bundle ESM
  temporario importado pelo Playwright CLI na origem localhost:8081, sem
  trocar env nem instanciar sender nos stores do app. QA usa nome de DB
  qa-preset-browser-*; nenhum dado de usuario/default outbox alterado.
- browser-preset-sync-code.js guarda o runner parametrizado por fixtures e
  URL do bundle. Duas abas com GoTrue/JWT/PostgREST e IndexedDB reais.
- Operacao offline manteve o mesmo ID na fila, sobreviveu a reload online
  e foi confirmada ao reconectar. Duas abas disputaram a mesma fila: uma
  reserva/envio, nao duas. Conta B nao leu nem alterou o preset da conta A.
- Resposta HTTP real foi retida depois do commit. stop encerrou o sender;
  liberada a resposta, a operacao ficou sending sem aplicar confirmacao.
  Outra aba, apos lease expirada (hora injetada somente no sender de QA),
  recuperou o recibo com o mesmo ID. SQL final: revisao 3 e 3 auditorias.
- Contas foram precriadas via admin LOCAL com email confirmado, login por
  senha ocorreu no browser. Nao comprova cadastro/telas/SMTP/redirects ou
  sessao de producao. Cache integrado ao nucleo testado; UI/AuthGate pendentes.
- Reload foi feito DEPOIS de restabelecer a rede. Nao existe service worker
  configurado para abrir/recarregar o aplicativo inteiro sem internet; esse
  requisito permanece pendente, nao substituido pelo teste da fila.
- browser-fixtures.mjs aceita apenas API local fixa da CLI. Privileged key
  permanece no Node; objeto passado ao browser contem chave anon local e
  credenciais temporarias de QA. Cleanup verifica nonce/email/metadata de
  fixtures e remove somente UUIDs correspondentes. Metadata e protecao do
  runner de testes, nao mecanismo de autorizacao do sistema.
- Fixture IndexedDB removida no finally; contas/preset/recibos/auditoria
  removidos pelo helper externo e contagem SQL final zerada. Servidores
  temporarios encerrados; localhost do app/site e remoto preservados.

## Leitura De Presets Pelo Servidor

- sync-preset-reader.ts consulta somente estruturas proprias nao default,
  incluindo deleted_at. Factory recebe client/conta fixos e AbortSignal;
  nao importa o singleton nem inicia leitura/envio nas telas atuais.
- Paginacao keyset por UUID crescente, sem offsets. Continua ate pagina
  vazia, mesmo se max_rows devolver menos itens que o tamanho solicitado.
  Escopo, ordem/progresso, revisao segura e payload normalizado sao validados;
  pagina invalida posterior rejeita o resultado inteiro, nao retorna parcial.
- Erros do servidor/rede nao expõem detalhes internos. Abort antes ou depois
  do request rejeita a leitura; uma resposta tardia nao e liberada ao caller.
- Ausencia de um ID nao significa exclusao. As paginas nao sao um snapshot
  transacional do servidor; insercoes concorrentes podem exigir outra busca.
  Consumidor deve mesclar registros por revisao, preservar pendencias e nao
  limpar o cache por uma resposta vazia. RLS continua sendo a autorizacao real.
- teste-sync-preset-reader.ts usa HTTP simulado para limites/paginas/erros,
  conta divergente, dados invalidos e abort tardio. teste-sync-preset-http-local.ts
  validou GoTrue/JWT/PostgREST reais: duas estruturas em paginas de um item,
  conta B sem leitura de A, revisao 4 mesclada no cache e tombstone revisao 5.
  IndexedDB simulado nessa combinacao. Contas/presets/recibos/auditoria de QA
  removidos; nao valida UI, Realtime, SMTP ou biblioteca compartilhavel.
- Tipagem manual inclui blind_structures com o contrato da quinta migracao
  LOCAL. Remoto ainda possui quatro migracoes; leitor nao esta ativado nele.
  20 suites, TypeScript e export web passaram. Integracao Auth/stores pendente.

Referencias: https://supabase.com/docs/reference/javascript/using-modifiers-order
e https://supabase.com/docs/reference/javascript/using-modifiers-limit

## Coordenador Por Conta

- PresetSyncSession conecta leitura local, sender e reader para uma conta
  fixa. synchronize concorrente compartilha a mesma rodada; recupera cache,
  envia pendencias de presets e consulta/mescla o servidor antes de publicar.
  mutate grava comando duravel e atualiza projecao local; envio e solicitado
  explicitamente por synchronize, nao por tarefa automatica oculta.
- phase ready significa rodada de recuperacao terminada, NAO que todas as
  operacoes foram confirmadas. UI deve inspecionar pending/issues e
  reconciliationNeeded; conflito/rejeicao continuam preservados para revisao.
  Erro de leitura mostra error sem limpar biblioteca/intencoes anteriores.
- stop aborta reader/sender e limpa a projecao em memoria; instancia encerrada
  nao reinicia. Resposta tardia nao publica estado. Comando que ja tenha sido
  persistido permanece na conta original; abort nao desfaz commit remoto.
  Outbox pertence ao caller e so deve ser fechado depois das tarefas terminarem.
- mergePresetBases valida conta e duplicacao de alvos e mescla em uma unica
  transacao cancelavel. Divergencia no ultimo registro ou abort durante a
  escrita desfaz todas as bases da rodada, sem alterar comandos pendentes.
- claim/sender aceitam escopo opcional. Coordenador de presets usa preset;
  comandos de tournament na mesma fila ficam intactos, nao reservados/rejeitados
  pelo transporte errado. Caminho generico anterior permanece sem filtro.
- teste-sync-preset-session.ts: coalescencia, isolamento, falha/reconexao,
  atomicidade de pull, abort durante escrita e resposta tardia apos stop,
  HTTP/IndexedDB simulados. teste-sync-preset-http-local.ts: coordenador com
  GoTrue/JWT/PostgREST reais recuperou duas estruturas, editou uma e confirmou
  revisao 2/conteudo remoto; IndexedDB simulado. Fixtures removidas.
- 21 suites, TypeScript e export web passaram. Provider/AuthGate web agora
  instanciam o coordenador sob flag. Eventos online/focus implementados;
  Realtime, revisao de conflitos, migracao dos presets locais e protecao de
  restore continuam pendentes. Nenhuma ativacao remota/alteracao de producao.

## Proximas Integracoes

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
