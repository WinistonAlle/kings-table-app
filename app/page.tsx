import { Topo } from '@/components/Topo';
import { Dor } from '@/components/Dor';
import { ComoFunciona } from '@/components/ComoFunciona';
import { Recursos } from '@/components/Recursos';
import { Precos } from '@/components/Precos';
import { Fechamento, Rodape } from '@/components/Rodape';

/* A ordem da página segue a ordem da cabeça de quem chega:
   1. o que é (topo), 2. por que me importo (a dor), 3. como resolve
   (três passos), 4. o que exatamente faz (recursos), 5. quanto custa. */
export default function Home() {
  return (
    <main>
      <Topo />
      <Dor />
      <ComoFunciona />
      <Recursos />
      <Precos />
      <Fechamento />
      <Rodape />
    </main>
  );
}
