import { HeroVideo } from '@/components/HeroVideo';
import { Cena } from '@/components/Cena';
import { Promessa } from '@/components/Promessa';
import { AntesDepois } from '@/components/AntesDepois';
import { Mesa } from '@/components/Mesa';
import { Recursos } from '@/components/Recursos';
import { Precos } from '@/components/Precos';
import { Perguntas } from '@/components/Perguntas';
import { Fechamento, Rodape } from '@/components/Rodape';

/* Sete dobras, na ordem da cabeça de quem chega:
   1. o que é (herói), 1b. o que ele FAZ, em uma frase (a promessa, que era
   subtítulo do herói e lá disputava com o vídeo), 2. por que me importo e
   como resolve — os dois na
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
      <Promessa />
      <AntesDepois />
      <Mesa />
      <Recursos />
      <Precos />
      <Perguntas />
      <Fechamento />
      <Rodape />
    </main>
  );
}
