import { Coroa, Marca } from './Marca';
import { Filete, Secao } from './Secao';
import { ListaEspera } from './ListaEspera';

export function Fechamento() {
  return (
    <Secao id="lista" className="py-24 text-center lg:py-32">
      <div className="mx-auto flex max-w-2xl flex-col items-center">
        <Marca className="w-[72px] text-gold500" />
        <h2 className="titulo mt-9 t-secao text-text0">
          A próxima quarta pode ser a última na planilha.
        </h2>
        <p className="medida mx-auto mt-6 t-corpo text-text2">
          O King&apos;s Table ainda não abriu. Deixe o seu e-mail e você entra
          antes de todo mundo, com o preço de quem chegou primeiro.
        </p>
        {/* O destino de todos os botões da página. */}
        <div className="mt-10 flex justify-center">
          <ListaEspera />
        </div>
        <div className="mt-14">
          <Filete largura={132} />
        </div>
      </div>
    </Secao>
  );
}

export function Rodape() {
  return (
    <footer className="border-t border-line">
      <Secao className="py-12">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <Coroa className="w-6 text-gold500" />
            <span className="titulo t-card text-text1">
              King&apos;s Table
            </span>
          </div>
          <p className="t-micro text-text3">
            &copy; {new Date().getFullYear()} King&apos;s Table
          </p>
        </div>
      </Secao>
    </footer>
  );
}
