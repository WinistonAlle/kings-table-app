import Link from 'next/link';
import { Coroa } from './Marca';

export function AcessoNav() {
  return <header className="acesso-nav">
    <Link href="/" className="acesso-marca" aria-label="King's Table, início"><Coroa /> <span>King’s Table</span></Link>
    <nav aria-label="Acesso à conta"><Link href="/login">Entrar</Link><Link href="/cadastro" className="acesso-criar">Criar conta</Link></nav>
  </header>;
}
