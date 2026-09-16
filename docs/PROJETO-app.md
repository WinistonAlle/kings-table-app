# King's Table App

## Botoes especulares em 16/09/2026

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
- Antes de conectar contas e convites: revisar politica de tournaments que permite
  leitura quando league_id IS NULL, politicas recursivas de league_members e
  funcao handle_new_user com search_path mutavel e EXECUTE publico. Os advisors
  reportaram os avisos de search_path e acesso SECURITY DEFINER em 16/09.

- O relogio ja possui estado separado por torneio; falta evoluir a mesma base
  para sincronizacao online entre anfitriao, telas e jogadores.
- Contas, autenticacao e sincronizacao Supabase nao estao implementadas.
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
- Leitura de comprovante de pagamento por foto, com valor e destinatario
  sugeridos para conferencia manual.
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
