# King's Table App

## Estado em 15/09/2026

App Expo SDK 54, Expo Router, React Native e Zustand. Preview web na porta
8081; landing independente na porta 3001. Nao alterar a landing para testar o app.

Identidade: preto neutro, dourado da marca, Sora nos titulos, Inter Tight
na interface e DM Mono em valores. Reutilizar constants/tokens.ts e components/ui.
Priorizar controles claros, legibilidade e fluxos curtos, nao os efeitos de
rolagem da landing. Existe uma alteracao previa do usuario em tokens.ts;
preservar e nao incluir em commits sem revisar a propriedade da mudanca.

## Implementado

- Criacao de torneios e presets Deep, Regular, Turbo e Hyper.
- Jogadores, entradas, reentradas, add-ons e pagamentos manuais.
- Eliminacao, desfazer, encerramento automatico e premios.
- Relogio com ancora temporal, pausa e persistencia AsyncStorage.
- Ranking local calculado dos torneios encerrados, agrupado por nome.
- Tela Mesas com busca, filtros e acesso a resultados, sem trocar a mesa
  ativa apenas para consultar um resultado.
- Perfil com dados reais e identificacao de recursos futuros.

## Pendencias importantes

- O relogio ja possui estado separado por torneio; falta evoluir a mesma base
  para sincronizacao online entre anfitriao, telas e jogadores.
- Contas, autenticacao e sincronizacao Supabase nao estao implementadas.
- IA e leitura de comprovantes nao estao conectadas. Rainha usa base local.
- Reentradas, add-ons, bounties, cash game e multimesa precisam de regras
  completas no dominio.
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
