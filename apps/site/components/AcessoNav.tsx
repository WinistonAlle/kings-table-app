import Link from 'next/link';
import { Coroa } from './Marca';
import { SpecularRim } from './SpecularRim';

export function AcessoNav() {
  return <header className="acesso-nav">
    <Link href="/" className="acesso-marca" aria-label="King's Table, início"><Coroa /> <span>King’s Table</span></Link>
    <nav aria-label="Acesso à conta"><Link href="/login" className="botao-especular"><SpecularRim />Entrar</Link><Link href="/cadastro" className="acesso-criar botao-especular"><SpecularRim />Criar conta</Link></nav>
  </header>;
}
