import 'server-only';
import { createClient } from '@supabase/supabase-js';

/* O cliente do Supabase, SÓ no servidor.
 *
 * `import 'server-only'` é a armadilha proposital: qualquer componente de
 * cliente que tentar importar este arquivo quebra o build, em vez de mandar a
 * conexão para o navegador. Mesma regra que o portfólio usa para o dicionário
 * de traduções.
 *
 * A chave é a ANÔNIMA, não a de serviço. A tabela tem RLS com uma única
 * policy de insert (ver a migração), então a chave anônima consegue
 * exatamente uma coisa: adicionar uma linha. Usar a chave de serviço aqui
 * daria poder de leitura a uma rota que só precisa escrever, e o dia em que
 * essa rota tivesse um bug ela vazaria a lista inteira.
 */
export function clienteSupabase() {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_ANON_KEY;
  if (!url || !chave) {
    throw new Error('SUPABASE_URL e SUPABASE_ANON_KEY precisam estar definidas.');
  }
  return createClient(url, chave, { auth: { persistSession: false } });
}
