import { Rotulo, Secao, Titulo, Realce } from './Secao';

/* As perguntas que travam uma inscrição.
 *
 * Sem preço fechado e sem prova, o que segura alguém de deixar o e-mail não é
 * falta de entusiasmo, é dúvida concreta. Estas quatro a página deixava sem
 * resposta, e todas têm resposta honesta hoje.
 *
 * `<details>`/`<summary>` nativo: abre e fecha sem uma linha de JavaScript,
 * funciona antes de a página hidratar, e já vem com o papel certo para o
 * leitor de tela. Um acordeão feito à mão aqui seria trabalho para chegar
 * atrás do que o navegador já faz.
 */

const PERGUNTAS = [
  {
    p: 'Tem Android?',
    r: 'Ainda não. O King’s Table começa no iPhone, e o Android vem depois — quem entrar na lista escolhe o aparelho e é avisado quando o dele chegar.',
  },
  {
    p: 'Todo mundo da mesa precisa instalar?',
    r: 'Não. Quem instala é quem organiza. Os jogadores entram na mesa pelo nome, como entram hoje na sua planilha, e não precisam de conta, de app nem de convite.',
  },
  {
    p: 'Quando abre?',
    r: 'Sem data anunciada, e não vou inventar uma. O relógio, o controle de pagamento, a premiação e o ranking já funcionam; falta a conta e a sincronização entre aparelhos. Quem está na lista sabe primeiro.',
  },
  {
    p: 'Onde ficam os dados da minha mesa?',
    r: 'Hoje, no seu aparelho — a noite inteira roda offline e nada sai dali. Quando a sincronização chegar, ela será opcional: quem quiser continuar só no telefone, continua.',
  },
];

export function Perguntas() {
  return (
    <Secao id="perguntas" className="py-24 lg:py-32">
      <div className="max-w-2xl">
        <Rotulo>Antes de entrar</Rotulo>
        <Titulo>
          O que você <Realce>ia perguntar</Realce>.
        </Titulo>
      </div>

      <div className="mt-14 max-w-3xl divide-y divide-line border-y border-line">
        {PERGUNTAS.map(({ p, r }) => (
          <details key={p} className="group py-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 [&::-webkit-details-marker]:hidden">
              <h3 className="titulo t-card text-text0">{p}</h3>
              {/* O sinal gira ao abrir. É a única animação aqui, e existe
                  para dizer "isto abre" antes de alguém clicar. */}
              <span
                aria-hidden
                className="shrink-0 text-gold500 transition-transform duration-300 group-open:rotate-45"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </span>
            </summary>
            <p className="medida mt-3 t-apoio text-text2">{r}</p>
          </details>
        ))}
      </div>
    </Secao>
  );
}
