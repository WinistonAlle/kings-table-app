# King's Table App

Checklist rastreavel do escopo completo: [CHECKLIST.md](CHECKLIST.md).
As secoes datadas preservam entregas anteriores; pendencias abaixo foram
atualizadas para nao contradizer as implementacoes mais recentes.

## Base de retry estavel para salvar presets em 01/10/2026

- `SyncOutbox.enqueuePreset` aceita um comando preparado uma unica vez e
  reserva a revisao em transacao atomica. Retry do mesmo comando reutiliza a
  entrada original; conteudo diferente no mesmo ID e revisao disputada recusados.
  `PresetSyncSession.enqueue` exige autoria da sessao e preserva abort/stop.
- Testes simulados incluem duas conexoes, tombstone, payload/identidade,
  rollback de quota e falha de confirmacao local depois da fila gravada.
  Duas abas Chromium com IndexedDB real conferiram uma unica reserva/revisao,
  retry, escopo e reload. Banco de QA separado removido ao terminar.
- Prova separada com Auth/JWT/HTTP locais reais e IndexedDB simulado conferiu
  sessao enfileirando/repetindo comando confirmado sem aumentar revisao.
  V43 delimita cobertura. Ainda falta conectar esta API ao salvamento pelo
  editor e testar esse fluxo de interface; nao substitui `save` existente.

## Estruturas salvas no editor online em 01/10/2026

- Biblioteca da conta reutilizada no editor da mesa existente. Selecao exige
  estrutura confirmada, sem pendencias/conflito, biblioteca pronta e mesa
  editavel. Criacao preserva o comportamento anterior da biblioteca.
- Substituir niveis pede confirmacao e altera somente o rascunho. Copia dos
  niveis permite personalizar esta mesa sem modificar a estrutura original.
- V42: Chromium com Auth/HTTP/IndexedDB locais reais conferiu recusa/aceite,
  independencia entre mesa e preset, pendencia de preset bloqueada/retry,
  cancelamento sem alterar mesa e isolamento A/B apos reload. Capturas
  390/1440 inspecionadas sem overflow; suite completa e tipos passaram.
- Salvar o rascunho como nova estrutura diretamente deste editor ainda falta;
  esse salvamento ja existe na criacao de mesa. Flags normais desligadas.

## Editor da estrutura online em 01/10/2026

- `OnlineStructure` conecta a estrutura da mesa existente ao editor de niveis
  e intervalos, antes do inicio. Campos e comandos paralelos ficam protegidos
  durante edicao/envio, revisao antiga ou reconciliacao pendente. Cancelar,
  fechar e atualizar pedem confirmacao de descarte; retry preserva o comando.
- Chromium com Auth/HTTP/IndexedDB locais reais conferiu edicao de blinds e
  duracoes, confirmacoes recusadas preservando campos, envio com uma auditoria
  e persistencia apos reload. Relogio confirmou 07:00 pausado e blinds 37/74.
  Capturas 320/390/1440 inspecionadas sem overflow. V40 delimita cobertura.
- V41 amplia o teste real local: RPC interrompido, fila apos reload e retry,
  conflito com alteracao concorrente real, recusa/aceite de manter conta e
  arquivo identificado como estrutura. Novo envio apos decisao e commit com
  resposta perdida recuperado apos lease real de 30 s, sem duplicar.
  Revisao/auditoria final 6; stores locais identicos apos hidratacao.
  Troca para conta B seguida de reload nao levou mesa nem rascunho A.
- Ainda faltam troca de conta sem recarga/resposta tardia durante logout,
  salvar novo preset nesta edicao, mudanca durante partida, quota fisica, outros browsers
  e validacao remota. Flag normal continua desligada.

## Base de edicao da estrutura online em 01/10/2026

- Comando `clock.structure` substitui a estrutura de uma mesa em preparacao,
  com autoria/revisao, recibo idempotente e auditoria atomicos. Usa a validacao
  compartilhada de niveis/intervalos; redefine nivel inicial e tempo da primeira
  linha, pausado. Nao muda jogadores, valores, reservas ou resultados.
- Migracao `20261001191608` aplicada somente localmente. SQL cobre dados
  invalidos/inalterados, revisao antiga, identidade reutilizada, rollback se a
  auditoria falhar, acesso de outra conta/anonimo e retry depois de iniciar.
  Duas conexoes reais conferem edicao/inicio nas duas ordens e mesmo comando
  concorrente, com um unico efeito. Checagem de seguranca local sem issues.
- Helper `prepareStructureOperation` normaliza o editor sem mutar entrada,
  rejeita estrutura inalterada e mesas fora da preparacao. Transporte aceitou
  comando em Auth/JWT/PostgREST reais locais, com resposta perdida apos commit,
  retry e leitura do novo tempo pausado. Falhas nao criam revisoes/recibos.
- CHECKLIST V39 delimita cobertura da base; editor e browser posteriores em
  V40; selecao de presets em V42. Alteracao ao vivo durante partida e remoto faltam.
  Flag permanece desligada. Nenhuma migracao foi enviada ao projeto remoto.

## Convidados da conta em 01/10/2026

- `OnlineInvites` integra convidados, presenca, espera, retirada e check-in
  aos comandos transacionais existentes, sob a flag de mesas online.
  Alteracoes exigem revisao atual e mesa em preparacao; ficam na mesma fila
  duravel e no historico de tentativas. Identidade original e preservada em retry.
- Confirmacao com mesa cheia pode virar espera, conforme resposta do servidor.
  Posicao usa `waiting_since`, incluindo microssegundos, e UUID como desempate;
  sair e voltar a espera entra no fim. Nenhuma promocao e inventada na UI.
- Check-in cria uma entrada pendente ou vincula jogador homonimo existente,
  sem duplicar buy-in. Convidado vinculado nao aceita presenca/retirada.
  Vagas ocupadas/reservadas deduplicam nomes conforme SQL; essa contagem
  tambem corrige validacao de cadastro e limite no agendamento.
- Formularios de agendamento, jogador e convidado bloqueiam edicoes paralelas
  e protegem rascunhos ao sair. Lista usa linhas, status e controles de 44 px.
- Chromium com Auth/HTTP/IndexedDB locais reais: capacidade de duas vagas,
  espera/promocao/reentrada na fila, retirada, duas chegadas (uma aproveitando
  jogador), duplicidade, conflito externo real e arquivo da tentativa.
  Resposta perdida apos commit/reload foi recuperada pelo botao de atualizacao
  depois do lease real de 30 s, sem duplicar. Revisao e auditoria final: 15.
  Conta B isolada e localStorage igual apos hidratacao. Capturas 320/390/1440
  inspecionadas; testes unitarios incluem ordem submilissegundo e desempate.
- CHECKLIST V38 delimita cobertura. Flag padrao desligada, sem alteracoes no
  remoto. Ainda faltam RSVP pelo convidado, link/codigo, Realtime, co-host,
  outros browsers e entrada tardia de convidados durante a partida.

## Espera limitada no acesso web em 01/10/2026

- Verificacao de identidade e hidratacao da conta tem limite de espera de
  12 s na interface, inclusive no teste local. Falha mostra explicacao e
  botao centralizado de tentar novamente, sem abrir dados protegidos.
- Troca de verificacao, desmontagem e logout invalidam a espera anterior.
  O pedido do SDK pode terminar depois; sua resposta antiga nao libera a
  conta nem inicia hidratacao apos o timeout. Nao e cancelamento HTTP do SDK.
- Chromium com login real no Supabase local: resposta HTTP 200 mantida
  pendente, timeout, liberacao atrasada ignorada, retry recuperado; erro HTTP
  503 bloqueado e recuperado. Cookies e localStorage permaneceram iguais.
  Capturas 390/1440 inspecionadas, botao centralizado e sem overflow mobile.
- Teste unitario integrado a suite cobre sucesso, erro, deadline, resposta
  tardia e cancelamento. CHECKLIST V37 registra limites: nao prova causa
  unica do relato original, fontes travadas, SMTP, remoto ou outros browsers.

## Transicoes do relogio online em 01/10/2026

- Tela distingue primeira leitura, espera da virada e estrutura concluida.
  Ao esgotar o ultimo nivel, informa que a partida ainda continua; nao
  encerra jogadores, calcula premios nem tenta retomar tempo zero.
- Chromium com Auth/HTTP e IndexedDB locais reais acompanhou tres niveis de
  um minuto, incluindo intervalo, sem acelerar tempo nem alterar a ancora.
  Falha de leitura na virada manteve nivel confirmado anterior e controles
  bloqueados; recuperacao leu intervalo e blind seguintes do servidor.
  Reload preservou nivel, fim ficou em 00:00 e revisao permaneceu 4.
- Requisicao real mantida pendente por mais de 12 s comprovou timeout,
  aviso/bloqueio e recuperacao. Uma tentativa na falha do limite e uma leitura
  atrasada, sem loop agressivo. LocalStorage permaneceu identico apos
  hidratacao. Capturas 390/1440 inspecionadas; CHECKLIST V36 delimita cobertura.
- Flag permanece desligada. Faltam segundo plano real/dispositivo, TV/audio
  online, Realtime, remoto e outros browsers. Nao e sincronizacao completa.

## Inicio protegido no servidor em 01/10/2026

- Comando `tournament.start` agora exige ao menos um jogador registrado e
  ainda ativo. Verificacao apos lock/revisao e consulta do recibo preserva
  idempotencia e impede corrida com retirada do ultimo jogador. Nao inicia
  automaticamente o relogio nem altera noites existentes.
- Migracao `20261001181551` aplicada apenas no banco local. SQL transacional,
  duas conexoes concorrentes e Auth/HTTP reais locais conferiram recusa sem
  revisao/recibo/auditoria, retry, isolamento e disputa inicio/retirada nos
  dois sentidos. Suite SQL completa e verificacao de seguranca passaram.
- Suite completa do app, TypeScript e build do site passaram; tabela de
  recibos tipada conforme o schema existente para verificar a recusa por HTTP.
- V35 substitui a pendencia do guard SQL registrada em V34. Nao foi aplicado
  no projeto remoto; a integracao online permanece sob flag desligada.

## Jogadores da conta em 01/10/2026

Atualizacao posterior: V34 integra relogio, inicio e eliminacoes na consulta
web sob flag. Os limites anteriores abaixo preservam o registro da etapa V33.

## Relogio e resultados da conta em 01/10/2026

- Consulta web integra inicio da noite, pausa/retomada, salto de nivel,
  intervalos, reinicio e hand-for-hand aos comandos transacionais existentes.
  Tempo usa referencia do servidor e elapsed monotonic; leitura a cada 15 s,
  foco/reconexao e limite do nivel, sem avancar localmente a estrutura.
  Falha/atraso/revisao divergente bloqueiam alteracoes ate atualizacao.
- Gerenciamento permite eliminar e desfazer somente a ultima eliminacao.
  Ultima queda encerra a noite e calcula premios no servidor; desfazer reabre
  pausada, sem premios. Confirmacao explica esses efeitos antes do comando.
- Testes de regras/lifecycle e Chromium com Auth/HTTP/IndexedDB locais reais
  passaram para controles, interrupcao de RPC com reload/retry, pausa por
  cliente concorrente, resultados/undo, isolamento e stores locais intactos.
  Capturas 1440/390 inspecionadas. CHECKLIST V34 delimita a verificacao.
- Suite completa, TypeScript, export web normal e build do site passaram.
  Export normal conferido sem backend de QA; previews 3001/8081 preservados.
  Contas/mesas temporarias e runner com credenciais removidos.
- Flag continua desligada. Faltam virada automatica/fim visual no navegador,
  timeout real de leitura, comprovantes, TV/audio online, Realtime, remoto,
  outros browsers e coordenacao multimesa. UI recusa iniciar mesa vazia;
  falta aplicar a mesma regra no comando SQL, que ainda permite esse caso.

## Registro da etapa de jogadores V33

- Consulta web agora permite adicionar/renomear jogadores, retirar entrada
  sem historico antes do inicio, registrar/corrigir reentradas e add-ons e
  marcar pagamento pendente, confirmado ou em revisao. Acoes financeiras
  mostram o total em centavos antes da confirmacao. Dados locais preservados.
- Acoes usam revisao dos detalhes e identidades estaveis; filas pendentes,
  detalhes antigos e edicao do agendamento bloqueiam novas alteracoes.
  Formulario de nome bloqueia a edicao paralela do agendamento. Atualizar,
  trocar ou fechar consulta protege campos nao registrados.
- Chromium com Auth/HTTP e IndexedDB locais reais confirmou comandos/eventos,
  persistencia da fila apos reload, recibo perdido sem duplicacao, conflito
  real com outro cliente, decisao explicita e arquivo da tentativa. Capturas
  1440/390 inspecionadas. CHECKLIST V33 detalha cobertura e limites.
- Flag continua desligada. Falta UI de convites/eliminacoes/relogio online,
  historico financeiro completo, custos de recompra independentes, recebimento
  parcial, remoto, outros browsers e quota fisica. Nao e sincronizacao completa.

## Criacao de mesas na conta em 01/10/2026

- Criacao web permite escolher aparelho ou conta quando a integracao online
  esta habilitada. Preserva buy-in livre, naipe/cor, estrutura personalizada,
  intervalos, local, vagas e agendamento. Limite de reentradas agora editavel
  entre 0 e 100 tambem no fluxo local.
- Criacao na conta prepara a mesa, sem iniciar automaticamente o relogio.
  Uma identidade/comando fica retida para retry; fila sobrevive a recarga.
  Tentativa definitivamente recusada pode ser arquivada com confirmacao,
  mantendo os dados originais neste navegador.
- Chromium com Auth/HTTP local e IndexedDB real validou interrupcao de RPC,
  recarga, confirmacao perdida apos gravacao real, retry sem duplicacao,
  configuracao e isolamento A/B. CHECKLIST V32 registra o escopo e limites.
- Flag permanece desligada. V33 integra parte da gestao de jogadores;
  relogio online, remoto, outros navegadores e quota fisica ainda faltam.

## Agendamento online em 01/10/2026

- Consulta da conta agora permite editar data, horario, local e limite de vagas
  em mesas agendadas. Mostra fila pendente, conflito, decisao explicita de manter
  versao da conta e tentativas arquivadas. Nova edicao exige detalhes atuais.
- Protecao de campos ao atualizar/trocar/fechar consulta; retry preserva ID do
  comando. Nenhuma escrita altera o store operacional local. Jogadores e
  resultados remotos continuam somente leitura neste fluxo.
- Chromium com Auth/HTTP local e IndexedDB real validou gravacao, recarga com
  RPC indisponivel, reconexao sem duplicacao, conflito real, decisao e nova
  edicao apos recuperacao. Capturas desktop/mobile inspecionadas. CHECKLIST V31
  registra limites; UI segue sob flag desativada no preview normal.
- Ainda faltam edicao integral, Realtime, remoto, outros browsers e protecao de
  rascunho ao navegar fora da tela. Nao anunciar sincronizacao como concluida.

## Recuperacao de conflitos online em 01/10/2026

- Nucleo da fila permite manter explicitamente a versao da conta apos
  conflito/rejeicao definitivo, arquivando tentativas e dependentes sem
  apagar seu conteudo/historico. Timeout ou envio incerto continuam bloqueados
  para evitar descartar uma alteracao que possa ter sido aceita.
- Decisao valida apenas com base/fila revisadas ainda iguais; isolamento por
  conta, transacao atomica, abort ao sair e espera antes de fechar armazenamento.
- Testes simulados e Chromium com duas abas/IndexedDB real passaram para o
  escopo descrito em CHECKLIST V30. V31 integra a decisao ao agendamento;
  edicao integral ainda falta. Preview normal permanece com a flag desligada.

## Consulta de mesas online em 01/10/2026

- A tela Mesas pode consultar o catalogo da conta e abrir jogadores,
  pagamentos e resultados somente leitura, separado das mesas neste aparelho.
  Provider por conta encerra ao sair; cache preserva dados apos erro de rede.
- A flag `EXPO_PUBLIC_TOURNAMENT_SYNC_ENABLED=1` habilita a consulta web;
  padrao continua desativado. Nativo e modo teste continuam locais.
- Chrome com Auth/HTTP locais e IndexedDB real confirmou isolamento A/B,
  leitura, cache apos reload com REST interrompido, retry e armazenamento
  local inalterado. Capturas desktop/mobile inspecionadas. Evidencias e
  limitacoes em CHECKLIST V29 e SINCRONIZACAO.md.
- Edicao sincronizada, reconciliacao do legado e cobertura integral do
  historico financeiro ainda faltam. Nao substituir o store local pelo
  snapshot remoto incompleto. Nenhuma configuracao remota foi alterada.

## Copia Online Em 23/09/2026

- A restauracao local agora escreve um diario com os tres arquivos anteriores
  e a copia de desfazer antes de substituir qualquer dado. As gravacoes sao
  aguardadas antes de trocar a memoria; falha parcial tenta rollback. Se a
  operacao for interrompida, a proxima abertura recupera os arquivos antes
  de hidratar a conta, inclusive se a mesma conta ja estava carregada.
- Teste por conta forcou falha de armazenamento durante a escrita e durante
  o rollback, alem de simular reinicio com diario pendente. Conferiu estado
  anterior na memoria e no disco, nova tentativa e limpeza do diario. As 22
  suites, TypeScript, export web e build do site passaram; preview 3301
  respondeu. Isto ainda nao valida cota real de navegador nem outros browsers.
- Chrome em localhost:3302 com duas contas temporarias no Supabase local.
  A conta A criou uma mesa com buy-in de R$ 73 e salvou uma copia online.
  Uma segunda sessao da mesma conta, sem mesas locais, leu a copia,
  restaurou a mesa e manteve nome, buy-in e 15 niveis apos reload. Desfazer
  recuperou o estado local vazio; a copia online continuou disponivel.
- A conta B nao viu a copia de A na interface nem em consulta autenticada
  direta. A primeira sessao de A atualizou a copia para a revisao 2; a
  segunda, ainda na revisao 1, recebeu conflito e nao a sobrescreveu.
- A tela agora compara quantidades de mesas e estruturas deste aparelho e
  da conta antes de salvar. Ao substituir uma copia maior por dados locais
  menores, a confirmacao avisa explicitamente sobre a perda na copia online.
  Cancelar nao envia gravacao. A secao tem largura contida no desktop e
  preserva a largura disponivel no mobile. Capturas 390x844 e 1440x900
  inspecionadas, sem overflow horizontal.
- O teste de interrupcao da requisicao de salvamento nao foi concluido
  antes da sessao de navegador encerrar; nao conta como validacao de falha
  de rede. Cota local real, rollback parcial no navegador, outros navegadores
  e Supabase remoto ainda precisam de verificacao. Contas e copia de QA
  foram removidas; nenhuma configuracao de producao foi alterada.

## Relogio E Qualidade Em 16/09/2026

- Hand-for-hand manual no controle do relogio: pausa preservando o tempo,
  bloqueia iniciar/avancar/voltar enquanto congelado, persiste por mesa e no
  backup. Sair deixa pausado ate o organizador retomar. TV apenas apresenta.
- Avisos sonoros web ativados por gesto: teste de som, ultimo minuto,
  avancar de nivel (inclui inicio/fim de intervalo) e fim da estrutura.
  Uma assinatura compartilhada evita sons duplicados ao navegar. Audio
  dura apenas nesta sessao e requer pagina visivel/contexto ativo. Voz,
  notificacoes remotas, segundo plano e nativo ainda nao foram implementados.
- Relogio observa apenas a tela em foco: paginas guardadas na pilha nao
  selecionam mesas nem mantem intervalos concorrentes. Noite nao iniciada,
  encerrada ou cancelada e pausada ao abrir o controle/apresentacao.
- Corrigido salvamento de clocks pausados que podia aninhar o mapa de todos
  os relogios dentro de cada clock. Agora apenas dados escalares/estrutura.
- Controle rola em telas baixas; pulso e clarao respeitam movimento reduzido.
  TV preserva ausencia de controles de alteracao de torneio.
- 14 suites, TypeScript e export web passaram. Playwright conferiu estado
  congelado, persistencia, TV somente leitura, ativacao/desativacao de sons
  e criacao de osciladores no teste/mudanca de nivel. Isso nao substitui
  verificar volume audivel no dispositivo do usuario.
- Capturas do navegador antigo falharam inclusive em Inicio; sessao nova
  capturou celular 390x844 e TV 1440x900, ambas inspecionadas. Testes de
  largura 320/390/1440 sem overflow horizontal. Dados de QA restaurados.
- Este e congelamento local, nao coordenacao de rodadas em varias mesas.
  F022/F023 no checklist mantem o restante do requisito em andamento.

## Transferencias realizadas em 16/09/2026

- Acerto agora registra pagamentos completos ou parciais, recalcula somente
  o saldo restante e permite estornar o registro sem apagar o historico.
  Confirmacao explicita para registro e estorno; nao transfere dinheiro.
- Lancamentos possuem ID, partes, centavos inteiros, data, base financeira
  e data de estorno. Persistidos na mesa, incluidos no backup online, no
  historico de alteracoes, resumo da noite e CSV especifico de transferencias.
- Registro valida os saldos atuais no store, rejeita valores negativos,
  fracionarios em centavos, partes invalidas, excesso e duplicacao apos quitar.
- Se entradas, pagamentos ou premios mudarem com lancamentos ativos, bloqueia
  novos acertos e pede revisao. Estornos continuam acessiveis no historico;
  nao cancela transferencia bancaria nem devolve dinheiro automaticamente.
- Entradas confirmadas continuam independentes de transferencias do acerto:
  nao marcar a entrada novamente para registrar pagamento de premio/acerto.
- Suite do acerto ampliada com parcial, quitacao, estorno idempotente,
  conflito de base, auditoria, serializacao, CSV e preservacao no backup.
  Treze suites, TypeScript e export web passaram. Navegador verificou parcial,
  recarga, estorno e auditoria persistidos, com dados temporarios removidos.
- Ainda faltam no financeiro completo: cash-in/cash-out de cash game,
  despesas, taxas, estornos financeiros reais e conciliacao bancaria.

## Acerto sugerido em 16/09/2026

- Mesa encerrada ganhou Acerto da noite: saldos individuais, caixa do
  organizador, transferencias sugeridas e resumo para copiar/compartilhar.
- Calculo em centavos inteiros: premio menos entradas pendentes. Entradas
  confirmadas sao consideradas ja recebidas no caixa, sem cobrar novamente.
  O organizador aparece como caixa separado, mesmo se tambem jogar.
- Na entrega inicial exigia confirmacao de que nenhum premio foi pago. Mudanca nos registros
  invalida essa confirmacao. Bloqueia noite aberta, contestacoes, duplicacao
  de jogadores/colocacoes, valores invalidos e premios divergentes das entradas.
- Casamento dos maiores saldos evita intermediarios e limita transferencias
  a participantes com saldo menos um; nao promete minimo matematico global.
- Na entrega inicial, apenas sugestao, sem registrar liquidacao. Pagamentos
  parciais, transferencias realizadas e estornos de registros foram adicionados
  na etapa documentada acima. Nao envia PIX. Cash-in/cash-out e despesas pendentes.
- Decima terceira suite verifica conservacao dos saldos, centavos, caixa,
  pendentes, bloqueios e ausencia de mutacao. TypeScript e export web passaram.
  Playwright validou confirmacao, exemplo financeiro e ausencia de overflow
  em 320/390/1440px. Fixture temporaria removida e dados anteriores preservados.

## Copia online por conta em 16/09/2026

- Perfil web: salvar manualmente mesas, presets e relogios na conta Supabase,
  consultar data e quantidade, restaurar com confirmacao e recuperar a copia
  local anterior. Nao restaura automaticamente no login.
- Validacao Zod do formato versionado, estruturas, referencias, contadores,
  relogios e tamanho maximo de 5 MB antes de substituir dados locais.
- Uma copia atual por conta, com revisao otimista: outra atualizacao entre
  consulta e salvamento bloqueia a substituicao em vez de perder dados.
- RLS restringe copia ao dono. Corrigidas leitura publica de perfis,
  leitura de torneios sem liga, recursao dos membros e acesso amplo a
  comprovantes. Administracao de membros agora restrita ao dono da liga;
  papeis delegados precisam de implementacao explicita na etapa de permissoes.
- Migracoes aplicadas no projeto hjxjxhnpcukwimiksbbz, verificacao de
  seguranca sem alertas. Testes SQL de duas contas, anonimo, versao e conflito
  executados com rollback; nenhum usuario de teste ficou no banco.
- Doze suites, TypeScript e export web passaram. Testes do servico usam
  transporte simulado; fluxo positivo em navegador com conta real ainda
  precisa ser validado. Preview de teste nao habilita backup remoto.
- Continua pendente: sincronizacao automatica/em tempo real, fila offline,
  QR remoto, controle remoto da TV e retencao de varias versoes no servidor.
  Persistencia local via Zustand/AsyncStorage nao e transacao entre arquivos;
  uma copia anterior e preservada antes de restaurar para permitir recuperacao.

## Botoes especulares em 16/09/2026

Revisao: preenchimento gold300 solido, sem degrade, arestas falsas ou sombra
grande. Brilho de borda reduzido a 60%, mantendo a hierarquia dos secundarios.

Revisao mobile: texto de corpo 16px, apoio 14px, rotulos 11px e titulos 30px;
KTButtons com minimo de 44px e altura expansivel para rotulos longos.
Editor de blinds com duas colunas abaixo de 600px e campos de 48px/16px;
controles de identidade e remocao com alvos de 44px. Glow difuso no contorno.

KTButton recebeu o brilho de borda do SpecularButton enviado pelo usuario,
adaptado para React Native Web, com OGL e shader SDF. Ouro nos primarios,
superficie neutra nos secundarios e vermelho preservado nas acoes de perigo.
Raio de 8px; tamanhos, icones, callbacks e bloqueio de desativados preservados.
No web, todos os KTButtons compartilham um renderer WebGL e usam canvases
2D para apresentar o resultado, sem um contexto GPU por botao. Luz acompanha
a proximidade do mouse e o foco. Para movimento reduzido, luz estatica;
no nativo, borda estatica equivalente sem dependencia WebGL.
Controles de selecao, tabs, linhas clicaveis e links nao viraram CTAs.
Playwright verificou pixels nao vazios do brilho, foco, desativados e
ausencia de overflow em desktop e mobile. TypeScript, nove suites e export
web passaram. Preview continua na porta 8081.

## Autenticacao web em 16/09/2026

Monorepo em `kings-table`, com acesso pela landing e sessao compartilhada
com o app web. Login, cadastro, recuperacao e nova senha em `apps/site`.
App web protegido por AuthGate; Perfil mostra conta e permite sair. Dados
locais separados por conta, sem sincronizacao remota nesta etapa. Nove
suites de testes, incluindo isolamento de mesas, presets e relogios.
Configuracao e validacoes pendentes em `docs/AUTENTICACAO.md` na raiz.

## Estado em 15/09/2026

App Expo SDK 54, Expo Router, React Native e Zustand. Preview web na porta
8081; landing independente na porta 3001. Nao alterar a landing para testar o app.

Identidade: preto neutro, dourado da marca, Sora nos titulos, Inter Tight
na interface e DM Mono em valores. Reutilizar constants/tokens.ts e components/ui.
Priorizar controles claros, legibilidade e fluxos curtos, nao os efeitos de
rolagem da landing. Existe uma alteracao previa do usuario em tokens.ts;
preservar e nao incluir em commits sem revisar a propriedade da mudanca.

## Implementado

- Resumo e exportacao em components/NightExport.tsx: previa selecionavel,
  copia no navegador, compartilhamento nativo e abertura do WhatsApp.
  Resumo separa classificacao parcial de resultado final, bolo registrado,
  valores marcados como pagos, pendentes e contestados; nao simula PIX nem
  pagamento de premios. Mesa vazia bloqueia envio, mantendo previa e CSV.
- CSV web de jogadores/pagamentos/assentos/resultado, estrutura com intervalos
  e auditoria detalhada. UTF-8 com BOM, separador ponto-e-virgula, aspas
  escapadas e neutralizacao de formulas em campos textuais. Arquivos gerados
  localmente, sem enviar dados a servidores nem alterar a mesa. Exportacao
  CSV nativa, ranking e importacao ficam para as proximas etapas.
- Decima suite em testes/teste-exportacao.ts: totais, estados, ordenacao,
  vazios, resultado final, escaping, formulas e ausencia de mutacao.
  Playwright validou copia real, download e ausencia de overflow em 320,
  390 e 768px com uma mesa temporaria no modo de teste, removida apos a
  verificacao. TypeScript, dez suites e exportacao web passaram.

- Assentos em components/SeatManager.tsx: sorteio em mesas de 2 a 12 lugares,
  lugares separados da colocacao final, lista ordenada, selecao manual de lugar
  livre e troca atomica entre dois jogadores. Sorteio substitui lugares somente
  depois de confirmacao. Disponivel para noites agendadas ou em andamento.
- Desfazer a ultima organizacao dos assentos restaura somente lugares e tamanho
  das mesas, preservando pagamentos e entradas. Bloqueado quando o conjunto de
  jogadores ativos mudou; nao restaura uma distribuicao invalida.
- Histórico local de alteracoes em components/NightAudit.tsx e lib/auditoria.ts:
  criacao, agenda, presenca, entradas, assentos, pagamentos, contadores,
  eliminacoes, colocacoes e premios, com data, valores anteriores e novos.
  Autor identificado como organizador deste aparelho, sem simular identidade
  autenticada. Historico persistido, expansivel e paginado em grupos de oito.
- Confirmacao para pagamentos, recompras, add-ons, eliminacao, remocao de entrada
  e reversao da eliminacao. Eliminacao do penultimo avisa sobre fechamento e
  premiacao automatica. Apenas a ultima eliminacao pode ser desfeita, evitando
  duplicacao de colocacoes; retorno para assento ja ocupado fica sem lugar.
- Testes em testes/teste-assentos.ts para sorteio, limites, trocas, preservacao
  financeira no desfazer, membros alterados, persistencia serializavel do historico
  e conflito de assento ao desfazer eliminacao.

- Agendamento integrado a Criar mesa: Jogar agora ou Agendar noite, data e
  horario local validados, local e limite de vagas opcionais. Edicao e cancelamento
  antes do inicio, com protecao de registros de entrada ao cancelar.
- Organizar a noite em components/NightPlanning.tsx: convidados, confirmado,
  talvez, ausencia e espera por ordem de entrada. Confirmacoes respeitam vagas;
  promocao da espera e manual, sem alterar presenca sem aprovacao.
- Convite textual por WhatsApp, copia no web e compartilhamento nativo.
  Respostas sao registradas pelo organizador; ainda nao ha link de RSVP remoto.
- Entrada confirmada e idempotente dos convidados, com um buy-in a receber.
  RSVP sozinho nao cria jogador nem gera cobranca. Iniciar noite requer duas
  entradas, confirma a acao e inicia o relogio. Eliminacao bloqueada antes do inicio.
- Datas e confirmados nas listas de mesas. Persistencia local inclui agenda e
  convidados; mesas anteriores sem estes campos continuam compativeis.
- Testes de agenda, datas invalidas, lotacao, duplicados, check-in e pagamentos
  em testes/teste-noite.ts, integrados a npm run testes.

- Criacao de torneios e presets Deep, Regular, Turbo e Hyper.
- Jogadores, entradas, reentradas, add-ons e pagamentos manuais.
- Eliminacao, desfazer, encerramento automatico e premios.
- Relogio com ancora temporal, pausa e persistencia AsyncStorage.
- Ranking local calculado dos torneios encerrados, agrupado por nome.
- Tela Mesas com busca, filtros e acesso a resultados, sem trocar a mesa
  ativa apenas para consultar um resultado.
- Perfil com dados reais e identificacao de recursos futuros.
- Buy-in livre, estruturas personalizadas com niveis e intervalos, presets
  salvos e identidade de mesa com naipe e cor persistidos.
- Relogio separado por torneio.
- Modo TV/projetor em app/display/[id].tsx: tempo, blinds atuais e seguintes,
  ante, intervalos, jogadores restantes, entradas, buy-in e premiacao.
  Acesso pela tela de relogio, sem controles de alteracao na apresentacao.
- Tela cheia no navegador quando suportada e manutencao da tela ligada
  enquanto a apresentacao esta em foco, nos aparelhos/navegadores compativeis.
- Favicon da marca em PNG compativel com o exportador e preview do Expo.
- Navegacao com abas Inicio, Mesas, Ranking, Rainha IA e Perfil.
- Botao Criar mesa permanente no topo de Inicio e Mesas, inclusive durante
  rolagem e quando ja existem mesas. Cabecalho compartilhado em
  components/MesasHeader.tsx, com botao de largura inteira no celular.
- Inicio com mesa em foco, troca de mesa e acessos explicitos a relogio e
  gestao; fallback para a mesa aberta mais recente quando nao ha mesa ativa.
- Lista de mesas com busca, filtros, Gerenciar mesa, Abrir relogio e Ver
  resultado, sem alterar a mesa ativa ao consultar uma mesa encerrada.
- Criacao com rotulos Nome da mesa, Identidade da mesa e Valor de entrada;
  botao Criar mesa de nome constante, orientacao de campos obrigatorios e
  cancelamento acessivel sem abertura automatica do teclado.
- Gestao com retorno explicito para Mesas, jogadores logo abaixo do
  formulario, confirmacao ao adicionar e botao Confirmar pagamento.
- Contadores de reentrada/add-on com alvos maiores, nomes acessiveis,
  decremento desabilitado em zero e empilhamento em telas estreitas.

## Pendencias importantes

- Supabase conectado pelo plugin em 16/09/2026. Projeto kings-table,
  ref hjxjxhnpcukwimiksbbz, organizacao winiston dev, plano free, sa-east-1.
  Reativado de INACTIVE para ACTIVE_HEALTHY. SQL e Auth health verificados;
  consulta REST de profiles com a chave publica do ambiente retornou HTTP 200.
  Nenhum dado, tabela ou politica alterado nesta etapa. Nao usar resultados
  transitorios de listagem durante RESTORING para concluir que o banco esta vazio.
- Banco remoto possui dez tabelas com RLS e migracao initial_schema de
  20260420000001. Todas reportaram zero linhas apos restauracao. O app permanece
  local: conexao administrativa pronta nao equivale a sincronizacao implementada.
- Politicas de tournaments, league_members e handle_new_user corrigidas na
  etapa de copia online. Advisors de seguranca sem alertas nessa verificacao.
  Isso nao substitui a revisao das permissoes dos novos recursos de dominio.

- O relogio ja possui estado separado por torneio; falta evoluir a mesma base
  para sincronizacao online entre anfitriao, telas e jogadores.
- Contas e autenticacao implementadas em 16/09 conforme a secao de acesso;
  sincronizacao Supabase ainda pendente; backup manual remoto implementado,
  com fluxo positivo de conta real ainda nao validado no navegador.
- .env.local corresponde ao projeto reativado e esta ignorado pelo Git. Falha
  ENOTFOUND de 15/09 superada apos reativacao. Ainda faltam migracoes de dominio,
  permissoes e integracao antes de conectar RSVP remoto, QR Code e telas ao vivo.
- O modo TV atual apresenta o estado local no proprio aparelho. Abrir a
  mesma mesa em outro aparelho ainda depende da sincronizacao online; nao
  comunicar este recurso como transmissao remota ou compartilhamento ao vivo.
- IA e leitura de comprovantes nao estao conectadas. Rainha usa base local.
- Reentradas, add-ons, bounties, cash game e multimesa precisam de regras
  completas no dominio.
- Multimesa ainda precisa de balanceamento entre mesas durante a noite, quebra
  de mesa e avisos remotos de movimentacao. A distribuicao atual cuida apenas dos
  assentos locais. Auditoria autenticada, backups no servidor e autorizacoes
  continuam dependentes da base online.
- Revisar acessibilidade e responsividade de ranking, gestao e relogio.
- Validar iOS/Android em aparelho real; web nao substitui testes nativos.

## Verificacao

`npm run testes`, `npx tsc --noEmit`, `npx expo export --platform web`.
O historico e os filtros usam lib/mesas.ts, com testes em testes/teste-mesas.ts.

## Backlog do produto

O escopo abaixo representa o sistema completo desejado. Cada grupo deve ser
implementado com estados vazios, carregamento, erro, confirmacao, desfazer
quando fizer sentido, persistencia e comportamento offline bem definido.

### Prioridade 0: nucleo comercial e confianca

- Conta, autenticacao, recuperacao de acesso e backup automatico.
- Sincronizacao em tempo real entre aparelhos, com o anfitriao controlando a
  mesa e os jogadores acompanhando sem alterar o estado.
- Acesso do jogador por QR Code, link, PIN ou magic link, sem exigir app
  instalado. Mostrar mesa, assento, blinds, nivel, relogio, posicao, avisos,
  premiacao e movimentos de mesa.
- Convites por link ou codigo, confirmacao de presenca, talvez, ausencia e
  lista de espera, com compartilhamento direto para WhatsApp.
- Agendamento de noites, calendario, lembretes e RSVP.
- Relogio por torneio, com pausa, intervalos, avisos visuais e sincronizacao
  sem drift entre anfitriao, celular e telas externas.
- Modo TV/projetor em tela cheia, com relogio, nivel atual, proximo nivel,
  blinds, intervalo, jogadores eliminados e premiacao.
- Controles de anfitriao e participante separados, com permissoes para
  anfitria, co-host, organizador, dealer e participante.
- Confirmacao de eliminacao, encerramento, pagamento e alteracoes sensiveis.
- Auditoria completa: quem alterou, quando, valor anterior, valor novo,
  historico de eventos e desfazer das acoes importantes.
- Onboarding curto para criar a primeira mesa sem explicacao externa.

### Prioridade 1: operacao de uma noite

- Criacao de mesa com buy-in livre, estruturas sugeridas ou personalizadas,
  niveis de blind, duracao, intervalos, ante, ritmo, reentrada, rebuy,
  add-on, bounty e regras da casa.
- Biblioteca de estruturas, conjuntos de fichas, premiacoes e configuracoes
  salvas, com duplicacao, edicao e compartilhamento por codigo.
- Cadastro de jogadores com nome, apelido, avatar, contato, historico,
  identificacao de registros duplicados e mesclagem de perfis.
- Entrada, reentrada, rebuy, add-on, bounty, pagamento parcial e observacoes.
- Sorteio automatico de assentos, troca manual, lista de espera e controle
  de entrada tardia.
- Suporte a varias mesas: balanceamento, movimentacao entre mesas, quebra de
  mesa e avisos para o jogador confirmar a troca.
- Fluxo claro de eliminacao, aprovacao do resultado e fechamento da noite.
- Calculadora de premiacao com percentuais, valores fixos, presets, acordo de
  chop, aprovacao ou recusa dos jogadores e registro do pagamento.
- Calculadoras de ICM, equity, pote, side pot e divisao de premiacao.
- Acerto financeiro inteligente: saldo por jogador, quem pagou quem,
  cash-in, cash-out, transferencias sugeridas e minimizacao dos pagamentos.
- Resumo final pronto para copiar e compartilhar no WhatsApp, com ranking,
  premiacao, pagamentos, eliminacoes e estatisticas da noite.
- Exportacao CSV e exportacao de torneio, jogadores, pagamentos, ranking e
  historico.
- Operacao offline com fila local de eventos e sincronizacao silenciosa
  quando a conexao voltar.

### Prioridade 1: ligas, temporadas e comunidade

- Ranking configuravel por liga: pontos, etapas, descarte dos piores
  resultados e criterios de desempate.
- Temporadas, calendario de etapas, ranking projetado ao vivo, pontuacao
  customizada, bonus, melhor de N, descarte de piores resultados e premios.
- Perfil historico por jogador: participacoes, vitorias, ITM, ROI, saldo,
  evolucao, tendencias e desempenho por periodo.
- Confrontos diretos, rivalidades, historico contra adversarios e ranking de
  melhores duelos.
- Badges, premios, conquistas e reconhecimentos por temporada.
- Filtros por periodo, temporada, local, mesa e formato.
- Pagina publica da liga com calendario, standings, premios, resultados e
  tracker ao vivo.
- Pagina publica de cada noite com modo espectador somente leitura.
- Estatisticas do local e comparativos entre locais.
- Enquetes e comunicados da liga.

### Prioridade 2: comunicacao e experiencia ao vivo

- Notificacoes de troca de nivel, ultimo minuto, fim de intervalo, convite,
  confirmacao de presenca e necessidade de troca de mesa.
- Avisos sonoros e de voz para mudancas de nivel, ultimo minuto, inicio e
  fim de intervalo.
- Modo hand-for-hand na bolha, congelando o relogio quando necessario.
- Tela do jogador com assento atual, mesa, posicao, relogio, movimentos e
  avisos que exigem confirmacao.
- Modo espectador para convidados acompanharem a noite por QR Code.
- Compositor de resultado e acerto com texto pronto para WhatsApp.
- Atividades em tempo real no celular, incluindo Live Activity/Dynamic
  Island quando houver suporte na plataforma.
- Temas, cores, naipes, identidade visual e branding customizaveis por mesa,
  liga e pagina publica.
- Moeda, fuso horario, idioma, formato de data e formato financeiro
  configuraveis.
- Acessibilidade: tamanho de texto, contraste, reduced motion, leitor de
  tela e telas de baixo consumo para TV.

### Prioridade 3: formatos e inteligencia

- Modo cash game com buy-in, cash-out, saldo, acerto, varias mesas e lista
  de espera.
- Formatos de torneio com bounty, rebuy, reentrada, add-on, satelite e
  multiplas mesas.
- Analise de foto de comprovante de pagamento com IA para sugerir valor e
  destinatario; o organizador confere e confirma antes de registrar.
- Rainha IA conectada a um modelo, com memoria do jogador e analise das maos.
- Trilhas de estudo e revisao das decisoes da noite.
- Registro de maos, envio de cartas, rabbit hunt, analise de VPIP, win rate,
  historico de maos e exportacao.
- Recomendacoes da Rainha IA para estrutura, premiacao, ritmo e organizacao.

### Prioridade 4: plataforma e administracao avancada

- API publica e webhooks para integracoes.
- Importacao de torneios, series, calendarios e estruturas por CSV ou PDF,
  com sugestoes da IA para conferencia.
- Painel administrativo com papeis owner, admin, floor e dealer.
- Console de dealer/floor para controle operacional de eventos maiores.
- Backups diarios no servidor, restauracao pontual e retencao configuravel.
- Pagina com dominio e branding customizados.
- Diagnosticos, privacidade, exportacao de dados, exclusao de conta e
  gerenciamento de sessoes.
- Infraestrutura cloud, hibrida ou on-premise para clubes profissionais.
- Jogo online integrado, com mesa virtual, voz e video. Este e um modulo de
  longo prazo separado da organizacao presencial, com motor de poker e
  infraestrutura de comunicacao proprios.

### Entrega e verificacao: modo TV

- Implementacao inicial concluida em 15/09/2026.
- Validar sempre a continuidade do tempo ao entrar/sair do modo TV, estado
  pausado, intervalo, fim da estrutura e mesa inexistente.
- Verificacao visual em desktop 1440x900 e celular 390x844, incluindo
  ausencia de overflow horizontal, e modo de intervalo em 1280x720.
- Sincronizacao online, QR Code para participantes e controle remoto ficam
  pendentes, conforme prioridade 0.

### Entrega e verificacao: navegacao e descoberta

- Concluida em 15/09/2026, mantendo o preview em http://localhost:8081.
- Fluxos conferidos no navegador: tela vazia, criacao com buy-in livre,
  adicao de jogador, retorno a Mesas, abertura de relogio, continuidade do
  tempo, criacao de segunda mesa, busca e confirmacao de pagamento.
- Layout conferido em 1440x900, 390x844 e 320x780. Criar mesa permanece
  visivel depois de rolar a lista; sem overflow horizontal no teste estreito.
- Testes do dominio, TypeScript e exportacao web passaram. Testes nativos
  em aparelho real continuam pendentes.

### Criterio de produto

O valor principal e tirar a organizacao da cabeca do anfitriao: abrir a mesa,
controlar o tempo, registrar entradas, fechar a premiacao e manter a historia
da liga. IA e recursos avancados entram depois que o fluxo basico for
confiavel, sincronizado e simples de usar.

## Monetizacao decidida

O plano e cobrar do organizador da mesa, nao de cada jogador. Os nomes das
assinaturas sao Home, Clube e Pro. Tambem existe o Passe para uma unica noite.

- Home, gratuito: uma mesa ativa, ate 10 jogadores, relogio, estruturas
  sugeridas, entradas, premiacao e historico local limitado.
- Clube, R$ 19,90 por mes: mesas e jogadores ilimitados, historico completo,
  ranking, estruturas personalizadas, intervalos, convite, compartilhamento,
  backup, sincronizacao e exportacao.
- Pro, R$ 39,90 por mes: varias ligas e temporadas, permissoes, ranking
  configuravel, relatorios financeiros, historico por jogador, leitura de
  comprovantes, Rainha IA com limite mensal e notificacoes.
- Passe, R$ 7,90 por noite: desbloqueia todos os recursos do Clube para uma
  unica noite, para quem joga ocasionalmente.

Preco anual sugerido: Clube por R$ 199,90 e Pro por R$ 399,90. O desconto
representa aproximadamente dois meses gratis e deve ser apresentado apenas
depois que o valor mensal estiver claro.

Plano de lancamento: teste gratis de 14 dias, sem cobrar IA antes de o relogio,
historico e sincronizacao estarem confiaveis. O Clube e o plano principal a
destacar. A comunicacao deve vender a economia de tempo e o fim da planilha,
do grupo confuso e da calculadora, nao apenas uma lista de funcionalidades.
