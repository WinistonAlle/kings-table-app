# Checklist do produto

Atualizado em 16/09/2026. Escopo integral: docs/PROJETO-app.md, docs/PROJETO-site.md,
docs/AUTENTICACAO.md, docs/PROXIMA-ETAPA.md e catalogo FEATURES da landing.
Web primeiro; mobile depois. Historico antigo nao substitui evidencia atual.

## Estados

- pendente: requisito completo ainda nao implementado, mesmo com uma parte existente.
- em andamento: implementacao ou verificacao ativa.
- implementado: codigo existe para o escopo indicado; validacao integral ainda falta.
- validado: evidencia atual cobre o requisito inteiro, incluindo erros e fluxo real.

Nenhuma area ampla e validada apenas por build ou teste unitario. Resultados
historicos estao nos documentos de passagem; os caminhos abaixo sao relativos
a apps/app quando nao indicado. Atualizar cada item ao concluir sua verificacao.

## Prioridades e dependencias

1. Fechar qualidade do relogio em andamento: invariantes, congelamento, TV,
   audio, responsividade, movimento reduzido e encerramento.
2. Consolidar persistencia e identidade online antes de QR, RSVP e controle remoto.
   Definir dono/co-host/participante, operacoes idempotentes, concorrencia,
   fila offline e recuperacao; nao substituir sincronizacao por backup manual.
3. Completar jogadores, regras de entradas, financeiro e auditoria autenticada.
4. Ligas/temporadas e comunicacao; formatos e calculadoras; IA depois da base.
5. Plataforma avancada, jogo online e mobile continuam no escopo, nao excluidos.

## Catalogo Integral

Os 106 itens da landing sao requisitos do sistema, nao prova de disponibilidade.
A descricao preserva o escopo original; a coluna de evidencia identifica apenas
as partes encontradas. Pendencias de configuracao/custo nunca autorizam gastos.

### Criação de mesas

| ID | Requisito e criterio de entrega | Estado | Evidencia ou lacuna |
|---|---|---|---|
| F001 | **Nome e buy-in livre**: Defina o nome da mesa e qualquer valor de entrada, inclusive com centavos. | implementado | types/index.ts; app/tournament/create.tsx; teste-estrutura.ts |
| F002 | **Estruturas de blinds**: Use Deep Stack, Regular, Turbo ou Hyper como sugestão, edite cada nível ou crie sua estrutura do zero. | implementado | StructureEditor.tsx; presetsStore.ts; teste-estrutura.ts |
| F003 | **Intervalos e ante**: Escolha a duração de cada nível, os intervalos, os valores de small blind, big blind e ante. | implementado | StructureEditor.tsx; lib/estrutura.ts |
| F004 | **Regras da casa**: Configure reentradas, rebuys, add-ons, bounties, limites e o ritmo da noite. | pendente | Reentradas e add-ons locais existem; faltam regras completas de rebuy/bounty e limites. |
| F005 | **Biblioteca de configurações**: Salve, duplique e compartilhe estruturas, conjuntos de fichas e tabelas de premiação por código. | pendente | Presets de blinds locais; faltam edicao, duplicacao, fichas, premios e codigo compartilhavel. |
| F006 | **Calendário de noites**: Organize data, horário, local e etapas em um calendário, com lembretes e integração com sua agenda. | pendente | Agenda local por noite; faltam calendario, lembretes e integracao. |
| F007 | **Convites e presença**: Convide por link, código ou WhatsApp e acompanhe quem confirmou, está em dúvida ou não vai. | pendente | Gestao local/WhatsApp; faltam link, codigo e RSVP remoto. |
| F008 | **Lista de espera**: Organize vagas, desistências e entrada tardia sem perder a ordem dos participantes. | pendente | Espera local; entrada tardia e fluxo completo ainda pendentes. |
| F009 | **Sorteio de assentos**: Distribua os jogadores automaticamente ou escolha os lugares manualmente. | implementado | SeatManager.tsx; lib/assentos.ts; teste-assentos.ts |
| F010 | **Múltiplas mesas**: Balanceie jogadores, mova participantes e desfaça mesas conforme o campo diminui. | pendente | Assentos por mesa locais; faltam balanceamento, quebra e avisos. |
| F011 | **Identidade da mesa**: Escolha cores, naipes, ícones, imagens, temas e identidade visual para cada grupo ou clube. | pendente | Naipe/cor locais; faltam imagens, temas, icones e branding por grupo. |
| F012 | **Do início ao encerramento**: Acompanhe preparação, início, andamento, aprovação dos resultados e fechamento da noite. | pendente | Fluxo local existe; falta aprovacao formal do resultado. |

### Relógio e blinds

| ID | Requisito e criterio de entrega | Estado | Evidencia ou lacuna |
|---|---|---|---|
| F013 | **Agora e a seguir**: Veja tempo restante, nível, small blind, big blind, ante e o próximo nível. | implementado | blinds/[id].tsx; display/[id].tsx |
| F014 | **Um relógio por torneio**: Troque de mesa preservando a estrutura, o nível e o tempo de cada torneio. | implementado | blindsStore.ts; teste-clock-controls.ts |
| F015 | **Pausar e retomar**: Pause, retome, avance ou volte um nível quando a mesa precisar. | implementado | lib/timer.ts; teste-timer.ts |
| F016 | **Tempo ao voltar**: Ao desbloquear a tela ou reabrir o app, o relógio acompanha o tempo realmente decorrido. | implementado | lib/timer.ts; teste-persistencia.ts |
| F017 | **Modo TV e projetor**: Exiba relógio, blinds, intervalos, jogadores restantes e premiação em tela cheia. | em andamento | Apresentacao local existe; validacao atual em andamento, remoto pendente. |
| F018 | **Controle pelo celular**: O organizador controla a noite enquanto a TV, o tablet e os jogadores acompanham. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F019 | **Sincronização ao vivo**: Mantenha as telas alinhadas pelo mesmo tempo de referência, sem relógios correndo separados. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F020 | **Intervalos programados**: Inclua pausas na estrutura e acompanhe o tempo de descanso até a retomada. | implementado | lib/estrutura.ts; lib/timer.ts |
| F021 | **Alertas visuais**: Destaques nos segundos finais e na mudança de nível ajudam a perceber o próximo blind. | em andamento | Pulso/clarao existentes; reduced motion e revisao atual pendentes. |
| F022 | **Avisos sonoros e voz**: Receba anúncios de mudança de nível, último minuto e início ou fim do intervalo. | em andamento | Sons web em andamento; voz e suporte nativo pendentes. |
| F023 | **Hand-for-hand**: Controle a bolha com rodadas sincronizadas e congelamento do relógio quando necessário. | em andamento | Congelamento local em andamento; coordenacao multimesa/remota pendente. |
| F024 | **Shot clock**: Acompanhe o tempo de decisão nas mesas que usam limite por ação. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F025 | **Atividades no celular**: Acompanhe o torneio com notificações e Live Activities, incluindo Dynamic Island em aparelhos compatíveis. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F026 | **Tela ligada e baixo consumo**: Mantenha a apresentação ativa, com opções de baixo consumo, contraste e movimento reduzido. | pendente | Keep-awake existe; baixo consumo e reduced motion completo pendentes. |

### Ranking de liga

| ID | Requisito e criterio de entrega | Estado | Evidencia ou lacuna |
|---|---|---|---|
| F027 | **Classificação automática**: Reúna posições, pontos, pódio e resultados das noites encerradas. | pendente | Ranking local por nome; identidade de jogador e liga ainda pendentes. |
| F028 | **Pontuação da sua liga**: Defina fórmulas, pontos por posição, participação, vitória, ITM e bônus por bounty. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F029 | **Temporadas e etapas**: Organize campeonatos, calendário de etapas e várias ligas independentes. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F030 | **Melhor de N e descartes**: Conte os melhores resultados, descarte as piores etapas e configure critérios de desempate. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F031 | **Ranking projetado**: Acompanhe como a classificação pode mudar durante a noite, antes do resultado final. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F032 | **Perfil por jogador**: Consulte participações, vitórias, prêmios, saldo, ITM e retorno sobre o investimento. | pendente | Agregados por nome locais; falta perfil persistente individual. |
| F033 | **Evolução e tendências**: Compare desempenho por período, temporada, formato, mesa e local. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F034 | **Confrontos diretos**: Veja resultados contra cada adversário e o histórico das rivalidades do grupo. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F035 | **Badges e conquistas**: Reconheça vitórias, consistência, eliminações, marcos e destaques da temporada. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F036 | **Prêmios de temporada**: Defina reconhecimentos e premiações para além de uma única noite. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F037 | **Página pública da liga**: Compartilhe calendário, classificação, resultados, prêmios e acompanhamento ao vivo. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F038 | **Estatísticas por local**: Compare noites e desempenho entre casas, clubes e outros ambientes de jogo. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F039 | **Enquetes e comunicados**: Combine datas, regras e decisões do campeonato com o grupo. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |

### Jogadores e entradas

| ID | Requisito e criterio de entrega | Estado | Evidencia ou lacuna |
|---|---|---|---|
| F040 | **Cadastro simples**: Adicione participantes por nome, apelido, avatar e contato, sem complicar a entrada na mesa. | pendente | Entrada por nome; faltam apelido, avatar e contato. |
| F041 | **Perfis sem duplicação**: Identifique cadastros repetidos e reúna o histórico de uma mesma pessoa. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F042 | **Entradas e recompras**: Registre buy-ins, reentradas, rebuys, add-ons e observações por jogador. | pendente | Contadores locais; faltam regras, observacoes e custos distintos. |
| F043 | **Eliminação e colocação**: Marque saídas, atribua posições e corrija uma eliminação registrada por engano. | implementado | lib/torneio.ts; teste-torneio.ts |
| F044 | **Painel do jogador**: Veja assento, mesa, blinds, relógio, posição, premiação e avisos em um único lugar. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F045 | **Acesso por QR Code**: Entre por QR Code, link, PIN ou magic link, sem precisar instalar um aplicativo. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F046 | **Movimentações de mesa**: Receba avisos de troca de assento ou mesa e confirme que a mudança foi recebida. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F047 | **Permissões por função**: Separe os acessos de anfitrião, co-host, organizador, participante e convidado. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F048 | **Equipe de operação**: Distribua funções de proprietário, administrador, floor e dealer nos eventos maiores. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F049 | **Passagem de organização**: Compartilhe o controle ou entregue a operação a outro anfitrião durante a noite. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F050 | **Confirmações de ações**: Confira eliminações, pagamentos, premiações e encerramentos antes de concluir. | pendente | Confirmacoes locais; validar todos os fluxos e autorizacao online. |
| F051 | **Acompanhamento de convidados**: Compartilhe uma visão somente de leitura para amigos e espectadores. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F052 | **Lembretes e avisos**: Receba convites, confirmações de presença, anúncios e atualizações da noite. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |

### Controle de pagamentos

| ID | Requisito e criterio de entrega | Estado | Evidencia ou lacuna |
|---|---|---|---|
| F053 | **Pago, pendente ou contestado**: Acompanhe o estado de cada pagamento e confirme os valores recebidos. | implementado | tournamentStore.ts; NightExport.tsx |
| F054 | **Total por jogador**: Veja o valor devido por entradas, reentradas e add-ons. | implementado | lib/payouts.ts; lib/exportacao.ts |
| F055 | **Pagamentos parciais**: Registre pagamentos em partes, observações e o saldo que ainda falta acertar. | pendente | Acerto final parcial existe; falta recebimento parcial de entradas durante a noite. |
| F056 | **Arrecadação da noite**: Acompanhe o bolo, o total recebido e as pendências. | implementado | lib/exportacao.ts; teste-exportacao.ts |
| F057 | **Quem pagou quem**: Mantenha um registro dos acertos entre jogadores e organizadores. | implementado | NightSettlement.tsx; lib/acerto.ts; teste-acerto.ts |
| F058 | **Cash-in e cash-out**: Registre entradas, saídas e saldos individuais nas noites de cash game. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F059 | **Acerto inteligente**: Organize quem deve pagar quem e reduza a quantidade de transferências necessárias. | pendente | Sugestoes locais e registros existem; minimo global e cash game ainda pendentes. |
| F060 | **Comprovantes por foto**: Use a leitura de comprovantes para sugerir valor e destinatário, com conferência do organizador. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F061 | **Relatórios financeiros**: Consulte saldos por pessoa, mesa, período, liga e temporada. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F062 | **Resumo no WhatsApp**: Compartilhe um fechamento pronto com valores, pendências e transferências sugeridas. | implementado | NightExport.tsx; lib/exportacao.ts |
| F063 | **Avisos financeiros**: Receba notificações de buy-ins, cash-outs e mudanças de pagamento. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F064 | **Histórico de alterações**: Confira quem registrou ou corrigiu cada lançamento e recupere ações importantes. | pendente | Auditoria local; faltam autoria autenticada e eventos online. |

### Premiação e resultados

| ID | Requisito e criterio de entrega | Estado | Evidencia ou lacuna |
|---|---|---|---|
| F065 | **Premiação automática**: Distribua o bolo conforme o campo e confira os valores de cada posição. | implementado | lib/payouts.ts; lib/torneio.ts |
| F066 | **Percentuais ou valores fixos**: Crie sua tabela de premiação ou escolha uma predefinição salva. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F067 | **Arredondamento correto**: Mantenha a soma dos prêmios igual ao valor total da premiação. | implementado | lib/payouts.ts; teste-logica.ts |
| F068 | **Acordos de chop**: Proponha divisões de prêmio e registre a aceitação ou recusa dos jogadores. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F069 | **Calculadora de ICM**: Compare divisões considerando fichas e faixas de premiação. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F070 | **Equity, pote e side pot**: Confira probabilidades, potes paralelos e divisões em situações com vários all-ins. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F071 | **Cash game**: Organize compras, saídas, saldos, várias mesas e lista de espera. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F072 | **Bounty e rebuys**: Controle recompensas por eliminação, recompras, reentradas e add-ons. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F073 | **Satélites e multimesa**: Configure diferentes formatos de torneio e eventos com vários campos. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F074 | **Campeão e posições**: Identifique o vencedor, registre colocações e aprove os resultados finais. | pendente | Resultado automatico; aprovacao formal ainda pendente. |
| F075 | **Pagamento dos prêmios**: Registre quem recebeu cada prêmio e o que ainda precisa ser acertado. | pendente | Acertos locais registrados; falta conciliacao especifica dos premios. |
| F076 | **Página pública da noite**: Compartilhe andamento, classificação, resultados e premiação por link. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F077 | **Resultado para compartilhar**: Prepare o resumo com posições, eliminados, estatísticas e acertos para o grupo. | pendente | Resumo local existe; estatisticas completas ainda pendentes. |
| F078 | **Impressão da operação**: Gere listas de assentos, participantes e premiação para acompanhar o evento. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |

### Histórico e plataforma

| ID | Requisito e criterio de entrega | Estado | Evidencia ou lacuna |
|---|---|---|---|
| F079 | **Histórico completo**: Consulte posições, prêmios, pagamentos e resultados de cada noite. | implementado | history.tsx; NightAudit.tsx |
| F080 | **Busca e filtros**: Encontre mesas abertas e encerradas por nome, período, local ou formato. | pendente | Nome/estado locais; faltam periodo, local e formato. |
| F081 | **Conta e recuperação**: Acesse seu perfil, recupere o acesso e gerencie as sessões da conta. | pendente | Telas/Auth implementados; e-mail real, renovacao e sessoes pendentes. |
| F082 | **Sincronização entre aparelhos**: Reúna os dados da mesa nos dispositivos do anfitrião, da equipe e dos jogadores. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F083 | **Operação offline**: Continue organizando a noite sem sinal e sincronize os registros quando a conexão voltar. | pendente | Persistencia local existe; fila e reconexao online pendentes. |
| F084 | **Backup automático**: Preserve os dados com backups no servidor e recuperação de versões anteriores. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F085 | **Restauração pontual**: Recupere um estado específico do histórico e configure a retenção dos backups. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F086 | **Auditoria e desfazer**: Veja autor, horário, valor anterior e valor novo de cada alteração importante. | pendente | Auditoria e algumas reversoes locais; autoria e cobertura completa pendentes. |
| F087 | **Importação e exportação**: Importe e exporte jogadores, torneios, pagamentos, estruturas, ranking e resultados em CSV. | pendente | CSV local de mesas/blinds/auditoria/acertos; importacao e ranking pendentes. |
| F088 | **Calendários e PDFs**: Importe séries, agendas e estruturas de arquivos, com sugestões da IA para conferir. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F089 | **API e webhooks**: Conecte o King’s Table a outras ferramentas e receba eventos nas suas integrações. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F090 | **Domínio e marca próprios**: Personalize a página pública do clube com domínio, cores e identidade visual. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F091 | **Console de dealer e floor**: Ofereça à equipe de operação um painel dedicado para eventos maiores. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F092 | **Idiomas, moedas e fusos**: Escolha moeda, idioma, fuso horário e formatos de data e valores. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F093 | **Acessibilidade**: Ajuste contraste, texto e movimento, com navegação por teclado e leitor de tela. | pendente | Melhorias locais; auditoria completa e ajustes do usuario pendentes. |
| F094 | **Privacidade e dados**: Gerencie sessões, exportação de dados pessoais, exclusão de conta e diagnósticos. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F095 | **Cloud, híbrido e on-premise**: Adapte a infraestrutura à operação de clubes e organizações profissionais. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F096 | **Primeira mesa sem complicação**: Encontre criação, jogadores, pagamentos e relógio em um fluxo curto e organizado. | implementado | MesasHeader.tsx; tournament/create.tsx |

### Rainha IA e estudos

| ID | Requisito e criterio de entrega | Estado | Evidencia ou lacuna |
|---|---|---|---|
| F097 | **Conversa com a Rainha**: Explore posição, pot odds, MDF, 3-bet e estratégia com uma assistente de poker. | pendente | Respostas locais, nao modelo de IA conectado. |
| F098 | **Memória do jogador**: Leve seu histórico, objetivos e evolução para conversas personalizadas. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F099 | **Análise de mãos**: Revise ações, tamanhos de aposta, cartas e decisões depois da noite. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F100 | **Trilhas de estudo**: Organize temas, exercícios e revisões conforme o que você quer melhorar. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F101 | **Registro e envio de cartas**: Guarde mãos, envie cartas e preserve o contexto de cada jogada. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F102 | **VPIP e win rate**: Acompanhe frequência de participação, resultados e tendências do seu jogo. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F103 | **Rabbit hunt e revisão**: Registre cartas de revisão e explore cenários das mãos que terminaram antes do river. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F104 | **Histórico de mãos**: Consulte e exporte as mãos registradas para estudar em outras ferramentas. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F105 | **IA para organizar a noite**: Receba sugestões de estrutura, ritmo, premiação e lembretes conforme o grupo. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |
| F106 | **Mesa online com voz e vídeo**: Leve o encontro para uma mesa virtual com jogo integrado e comunicação entre os participantes. | pendente | Sem evidencia suficiente de implementacao do requisito completo. |

## Requisitos Complementares Dos Documentos

| ID | Requisito | Estado | Dependencia/evidencia |
|---|---|---|---|
| D01 | Backup manual por conta, restauracao confirmada e recuperacao local anterior | implementado | CloudBackup.web.tsx; account-backup.ts; RPC/RLS testados; fluxo com conta real pendente. Nao substitui F084/F085. |
| D02 | Login, cadastro, confirmacao, renovacao, recuperacao, logout e sessao landing/app | em andamento | AUTENTICACAO.md; validacao positiva com e-mail real e redirects pendente. |
| D03 | Sincronizacao sem drift, concorrencia, isolamento, idempotencia e recuperacao offline | em andamento | SINCRONIZACAO.md: contrato, lacunas conferidas no banco e gates; troca local serializada. Fila, comandos, migracoes e integracao remota ainda pendentes. |
| D04 | Transferencias completas/parciais, estorno de registro e saldo restante | implementado | acerto.ts; NightSettlement.tsx; auditoria/CSV/backup e testes locais. |
| D05 | Despesas, taxas, conciliacao e estornos financeiros reais | pendente | Definir modelo contabil completo; estorno de registro nao devolve dinheiro. |
| D06 | Biblioteca de premios, chop, aprovacao/recusa e fechamento formal | pendente | Modelo versionado de premiacao e autorizacoes. |
| D07 | Planos Home/Clube/Pro/Passe, anual, teste 14 dias e limites de recursos | pendente | Precos na landing; nao ha checkout nem ativacao. Integracao/cobranca somente com aprovacao. |
| D08 | Deploy, dominio, SMTP e configuracao de producao | pendente | Requer aprovacao antes de publicar/contratar; nao alterar localhost 3001/8081. |
| D09 | Lista de espera da landing com duplicados, validacao e privacidade | pendente | Migracao de lista ainda nao aplicada; verificar rota e autorizacao antes de integrar. |
| D10 | Tokens compartilhados site/app e revisao de dependencias vulneraveis | pendente | PROXIMA-ETAPA/REPOSITORIO; preservar identidade e React compativel com Expo. |
| D11 | Backups automaticos, retencao, restauracao pontual e fila local de eventos | pendente | Backup atual e uma unica copia manual; desenho de versoes/eventos necessario. |
| D12 | Aplicativo iOS/Android, acessibilidade nativa e testes em aparelhos reais | pendente | Depois de consolidar web; export web nao valida nativo. |

## Registro Da Etapa Atual

- Isolamento local: carregamento serializado, falhas de hidratacao bloqueadas
  e respostas Auth antigas descartadas. Unitarios e Playwright passaram;
  Auth do teste de corrida e simulado. Cadastro/e-mail real ainda pendentes.
- Aviso DOM collapsable corrigido no anel SVG; navegador revalidado com
  zero erros e dois avisos antigos de shadow/pointerEvents do React Native.
- Criacao local: IDs de mesas nao colidem com outras mesas existentes na conta
  quando criadas no mesmo milissegundo. Teste cobre rehydrate, jogador isolado
  e exclusao independente. Identidade global entre aparelhos e idempotencia
  de operacoes remotas continuam pendentes; esta correcao nao as substitui.
- Relogio/hand-for-hand: implementacao local e testes de invariantes existem;
  fluxo local de congelamento/TV/reload conferido. Coordenacao remota,
  rodadas multimesa e cobertura do encerramento ainda exigem verificacao.
- A captura visual anterior excedeu o tempo limite. Dados temporarios foram
  removidos no finally; essa execucao nao provou o fluxo posterior de som/TV.
- Audio atual e apenas web, manual, nesta sessao e com pagina visivel. Voz,
  segundo plano, alertas remotos e suporte nativo nao estao entregues.
- Operacoes destrutivas, publicacao em producao, cobranca e servicos pagos
  requerem consulta. Preservar alteracoes locais, dados e backups existentes.

## Verificacoes Incrementais

| ID | Escopo especifico da verificacao | Estado | Evidencia atual |
|---|---|---|---|
| V01 | Congelamento local, start bloqueado, saida pausada, troca A/B e rehydrate | validado | teste-clock-controls.ts, executado em 16/09; nao valida multimesa remota. |
| V02 | Detecao de minuto, nivel e fim, sem duplicar a cada tick | validado | clock-alerts.ts e teste-clock-controls.ts; pipeline web criou osciladores no teste e no salto de nivel. Nao prova audio audivel no hardware do usuario. |
| V03 | TV somente leitura do estado do torneio e hand-for-hand persistido no reload | validado | Playwright atual; screenshot clock-controls-tv.png; controles de alteracao ausentes. |
| V04 | Layout do controle em 320/390/1440 e leitura visual em 390/1440 | validado | Playwright sem overflow; capturas clock-controls-mobile.png e clock-controls-tv.png inspecionadas em sessao nova. |
| V05 | TypeScript, 14 suites e export web das alteracoes atuais | validado | npx tsc --noEmit; npm run testes; expo export web, todos passaram. |
| V06 | Voz, audio nativo/segundo plano e coordenacao multimesa/remota | pendente | Nao implementados nem validados; F022/F023 permanecem em andamento. |
| V07 | Criacoes locais no mesmo milissegundo, inclusive apos rehydrate | validado | teste-contas.ts: IDs distintos, jogador isolado e exclusao independente; nao cobre concorrencia entre aparelhos. |
| V08 | Trocas locais concorrentes, erro de leitura e recuperacao da fila | validado | teste-contas.ts: leitura controlada, scopes dos tres stores e dados da conta A preservados. |
| V09 | Resposta Auth antiga descartada e conta B isolada na UI mobile | validado | Playwright com Auth simulado; account-isolation-mobile.png inspecionada. Nao valida fluxo Auth real. |
