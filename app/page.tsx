import { HeroVideo } from '@/components/HeroVideo';
import { Cena } from '@/components/Cena';
import { AntesDepois } from '@/components/AntesDepois';
import { Recursos } from '@/components/Recursos';
import { Precos } from '@/components/Precos';
import { Perguntas } from '@/components/Perguntas';
import { Fechamento, Rodape } from '@/components/Rodape';

/* Seis dobras, na ordem da cabeça de quem chega:
   1. o que é (herói), 2. por que me importo e como resolve — os dois na
   MESMA dobra, porque são um argumento só, 3. o que exatamente faz,
   4. quanto custa, 5. o que eu ia perguntar, 6. onde eu deixo meu e-mail.

   Eram sete. "A dor" e "Como funciona" eram duas seções com dois títulos
   sustentando a mesma frase: hoje é assim, com o app é assado. A virada
   acontecia num vão de 200px entre elas, que é o lugar onde ela não
   acontece. */
export default function Home() {
  return (
    <main>
      <Cena />
      <HeroVideo />
      <AntesDepois />
      <Recursos />
      <Precos />
      <Perguntas />
      <Fechamento />
      <Rodape />
    </main>
  );
}
