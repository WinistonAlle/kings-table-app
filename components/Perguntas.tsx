import { Rotulo, Secao, Titulo, Realce } from './Secao';

const PERGUNTAS = [
  ['O que é o King’s Table?', 'Um aplicativo para organizar torneios de poker presencial: blinds, jogadores, entradas, controle manual de pagamentos, premiação e ranking da liga. Ele não é uma sala de poker online.'],
  ['Todo mundo precisa instalar?', 'Não. Quem organiza usa o aplicativo e adiciona os jogadores pelo nome. Os participantes não precisam instalar nem criar conta.'],
  ['Preciso de internet para usar?', 'As funções de organização já implementadas funcionam offline. Torneios e relógio ficam no aparelho.'],
  ['O relógio continua certo com a tela bloqueada?', 'Sim. Ao voltar ao aplicativo, o tempo e os níveis são recalculados a partir do relógio real, incluindo os níveis que passaram enquanto a tela estava bloqueada.'],
  ['Posso pausar ou mudar os blinds?', 'Você pode pausar, retomar, avançar e voltar um nível. Ao criar a mesa, escolhe um dos quatro ritmos disponíveis: Deep Stack, Regular, Turbo e Hyper.'],
  ['Como funcionam reentradas e add-ons?', 'Você registra as quantidades por jogador. Cada entrada tem o valor do buy-in da mesa e atualiza o total devido e o bolo.'],
  ['O aplicativo confirma ou recebe PIX?', 'Não. Você marca quem pagou e quem está pendente ou contestado. O app não movimenta dinheiro nem confirma comprovantes automaticamente.'],
  ['Como a premiação é calculada?', 'A distribuição usa o número de participantes e o bolo das entradas registradas. Os percentuais e valores aparecem por posição, com ajuste de arredondamento para a soma fechar.'],
  ['Registrei uma eliminação errada. Posso corrigir?', 'Sim. A ação de desfazer devolve o jogador ao torneio. Se a noite já terminou, ela também reabre o torneio para corrigir o resultado.'],
  ['Como o ranking funciona?', 'Os torneios encerrados geram pontos conforme a posição final e o tamanho do campo. Hoje a liga reúne os resultados deste aparelho, agrupando jogadores pelo nome.'],
  ['Meus dados aparecem em outro aparelho?', 'Ainda não. Os dados ficam salvos localmente; conta, sincronização e histórico pessoal entre aparelhos são recursos futuros.'],
  ['A Rainha já analisa minhas mãos com IA?', 'Ainda não. Existe um protótipo com respostas locais sobre alguns fundamentos. IA personalizada, treino de mãos e trilha de estudos estão planejados.'],
  ['Quando será lançado? Terá Android?', 'Ainda não há data anunciada. O lançamento prioriza iPhone; Android fica para uma etapa posterior. A lista de espera recebe as novidades da abertura.'],
  ['Quanto vai custar?', 'Os preços ainda não foram definidos. Os planos serão divulgados antes da abertura; entrar na lista não exige pagamento.'],
];

export function Perguntas() {
  return (
    <Secao id="perguntas" className="py-24 lg:py-32">
      <div className="mx-auto max-w-2xl text-center">
        <Rotulo>Antes de entrar</Rotulo>
        <Titulo>Suas dúvidas, <Realce>na mesa.</Realce></Titulo>
      </div>
      <div className="mx-auto mt-14 max-w-3xl divide-y divide-line border-y border-line">
        {PERGUNTAS.map(([p, r]) => (
          <details key={p} name="duvidas" className="group py-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 [&::-webkit-details-marker]:hidden">
              <span className="titulo text-[1.1rem] leading-snug text-text0">{p}</span>
              <span aria-hidden className="shrink-0 text-2xl text-gold300 transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-4 max-w-2xl t-apoio text-text1">{r}</p>
          </details>
        ))}
      </div>
    </Secao>
  );
}
