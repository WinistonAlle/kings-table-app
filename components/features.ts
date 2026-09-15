export const FEATURES = [
  { nome: 'Criação de mesas', resumo: 'A noite começa com três decisões.', beneficio: 'Defina a mesa uma vez e concentre sua atenção no jogo.', itens: [
    ['Nome e buy-in', 'Crie uma mesa com o nome da noite e o valor de entrada.'],
    ['Quatro ritmos', 'Escolha Deep Stack, Regular, Turbo ou Hyper para definir a velocidade dos blinds.'],
    ['Reentradas', 'Configure a permissão de reentrada e registre as compras durante a noite.'],
  ] },
  { nome: 'Relógio e blinds', resumo: 'O próximo nível chega sem alguém precisar vigiar.', beneficio: 'Menos interrupções para perguntar o blind. Mais atenção à mesa.', itens: [
    ['Agora e a seguir', 'Tempo restante, nível, small blind, big blind e ante, com previsão do próximo nível.'],
    ['Tempo correto ao voltar', 'Ao reabrir o app ou desbloquear a tela, o relógio recalcula os níveis que passaram.'],
    ['Você controla as pausas', 'Pause, retome, avance ou volte um nível quando a mesa precisar.'],
    ['Alertas visuais', 'Avisos nos últimos 60 e 30 segundos e na troca de nível.'],
  ] },
  { nome: 'Ranking de liga', resumo: 'Cada noite conta para a classificação.', beneficio: 'A disputa continua na próxima mesa, com resultados que todos podem acompanhar.', itens: [
    ['Pontos por resultado', 'A posição final e o tamanho do campo determinam os pontos de cada jogador.'],
    ['Classificação automática', 'Os torneios encerrados alimentam o ranking e o pódio dos três primeiros.'],
    ['Participação e saldo', 'Veja noites disputadas e saldo acumulado. O cálculo também reúne vitórias, ITM e prêmios.'],
    ['Desempates definidos', 'Empates são resolvidos por vitórias, saldo e nome. Hoje os participantes são agrupados pelo nome nos torneios deste aparelho.'],
  ] },
  { nome: 'Jogadores e entradas', resumo: 'Quem entrou, recomprou e caiu fica registrado.', beneficio: 'Você acompanha a mesa sem depender de papel ou memória.', itens: [
    ['Jogadores pelo nome', 'Adicione e remova participantes sem exigir uma conta de cada pessoa.'],
    ['Reentradas e add-ons', 'Registre ou corrija as quantidades e acompanhe o total de entradas por jogador.'],
    ['Eliminação e posição', 'Marque a saída de um jogador para atribuir a colocação automaticamente.'],
    ['Desfazer', 'Corrija uma eliminação registrada por engano, inclusive após o encerramento.'],
  ] },
  { nome: 'Controle de pagamentos', resumo: 'A conta de cada jogador fica à vista.', beneficio: 'Confira quem acertou e o que falta receber antes de fechar a noite.', itens: [
    ['Três estados', 'Marque o participante como a receber, pago ou contestado.'],
    ['Valor por jogador', 'O total devido acompanha as entradas, reentradas e add-ons registrados.'],
    ['Bolo atualizado', 'Cada entrada registrada atualiza o bolo. Valores pendentes também entram nessa soma.'],
    ['Controle manual', 'O aplicativo registra a conferência feita por você; não cobra, transfere ou confirma PIX automaticamente.'],
  ] },
  { nome: 'Premiação e resultados', resumo: 'A noite termina com posições e valores definidos.', beneficio: 'Troque a conta feita no cansaço por uma distribuição pronta para conferir.', itens: [
    ['Faixas automáticas', 'A distribuição dos prêmios acompanha o número de jogadores e o bolo registrado.'],
    ['Percentuais e valores', 'Veja quanto cada posição recebe enquanto o torneio acontece.'],
    ['A soma fecha', 'O ajuste de arredondamento mantém a soma dos prêmios igual ao bolo.'],
    ['Campeão e resultado', 'Quando sobra um jogador, o torneio encerra, identifica o campeão e grava os prêmios por posição. Isso não efetua o pagamento.'],
  ] },
  { nome: 'Histórico e uso offline', resumo: 'A organização continua mesmo sem sinal.', beneficio: 'A mesa não depende do Wi-Fi da casa para funcionar.', itens: [
    ['Sem conexão ou conta', 'Torneios, pagamentos manuais e relógio funcionam no aparelho.'],
    ['Dados persistentes', 'Torneios e estado do relógio ficam salvos quando você fecha o aplicativo.'],
    ['Resultados guardados', 'Consulte as posições e prêmios dos torneios armazenados.'],
    ['Resumo da liga', 'Veja noites encerradas, jogadores e total em prêmios. Os dados ainda não sincronizam entre aparelhos.'],
  ] },
  { nome: 'Rainha IA · em breve', resumo: 'Uma conselheira para estudar fora da mesa.', beneficio: 'A proposta é revisar suas decisões e levar o aprendizado para a próxima noite.', futuro: true, itens: [
    ['O que existe hoje', 'Um protótipo de conversa com respostas locais sobre posição, big blind, MDF, 3-bet e pot odds.'],
    ['IA e análise de mãos', 'A conexão com um modelo e a análise personalizada ainda não estão disponíveis.'],
    ['Treino e trilha de estudos', 'Recursos planejados, ainda não implementados.'],
  ] },
];

export const FEATURE_NAMES = FEATURES.map(feature => feature.nome);
