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

- Relogio global ainda nao pertence a um torneio especifico. Criar outra
  mesa redefine a estrutura; trocar a mesa ativa pode associar o relogio
  errado. Implementar estados de relogio por torneio antes de uso multimesa.
- Contas, autenticacao e sincronizacao Supabase nao estao implementadas.
- IA e leitura de comprovantes nao estao conectadas. Rainha usa base local.
- Escolha de naipe na criacao ainda nao e persistida.
- Reentradas e add-ons precisam revisao das regras e limites no dominio.
- Revisar acessibilidade e responsividade de ranking, gestao e relogio.
- Validar iOS/Android em aparelho real; web nao substitui testes nativos.

## Verificacao

`npm run testes`, `npx tsc --noEmit`, `npx expo export --platform web`.
O historico e os filtros usam lib/mesas.ts, com testes em testes/teste-mesas.ts.

## Backlog do produto

### Prioridade 0: confianca para cobrar

- Relogio separado por torneio, com troca de mesa sem misturar estrutura,
  nivel, pausa ou tempo restante.
- Conta, autenticacao e backup automatico.
- Sincronizacao entre aparelhos, com o anfitriao controlando a mesa e os
  jogadores acompanhando o relogio em seus celulares.
- Convite por link ou codigo e compartilhamento de mesa e resultado no
  WhatsApp.
- Confirmacao antes de eliminar ou encerrar, historico de alteracoes e
  desfazer para todas as acoes importantes.
- Onboarding curto para criar a primeira mesa sem explicacao externa.

### Prioridade 1: produto para ligas

- Ranking configuravel por liga: pontos, etapas, descarte dos piores
  resultados e criterios de desempate.
- Perfil historico por jogador, com participacoes, vitorias, ITM, saldo e
  evolucao por temporada.
- Saldo financeiro por jogador, registro de quem pagou quem e observacoes.
- Fechamento da noite com resumo pronto para compartilhar.
- Permissoes para anfitas, organizadores e participantes.
- Backup e exportacao dos torneios e resultados.

### Prioridade 2: expansao da experiencia

- Leitura de comprovante de pagamento por foto, com valor e destinatario
  sugeridos para conferencia manual.
- Rainha IA conectada a um modelo, com memoria do jogador e analise das maos.
- Trilhas de estudo e revisao das decisoes da noite.
- Notificacoes de troca de nivel, fim de intervalo e convite para a mesa.
- Suporte a mais formatos, como cash game, bounty e torneio com rebuy.
- Temas, cores, naipes e identidade visual personalizaveis por mesa e liga.

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
