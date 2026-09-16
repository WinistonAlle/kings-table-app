# Próxima etapa: a sessão compartilhada

Registrado em 16/09/2026, a pedido do usuário, ao fechar a unificação.

## O que precisa existir

Login e cadastro na landing, levando ao app rodando no navegador. Hoje os
dois lados não se falam: o usuário se cadastra no site e isso não vira conta
no app.

**Tem que ser o mesmo Supabase.** Não dois projetos sincronizados, não um
espelho: a mesma instância, a mesma tabela de usuários. É o que faz "cadastro
no site" e "conta no app" serem a mesma coisa.

## O estado de hoje, que a próxima etapa herda

- O app tem `.env.local` apontando para um projeto Supabase e um cliente em
  `apps/app/lib/supabase.ts` que **nunca é chamado** em lugar nenhum.
- O site **não tem `.env.local`** e a migração da lista de espera nunca foi
  aplicada.
- As duas migrações já estão lado a lado em `packages/db/migrations/`,
  nenhuma aplicada.

## Ordem sugerida

1. Decidir qual projeto Supabase é o definitivo (provavelmente o do app, que
   já tem as 9 tabelas e o RLS).
2. Aplicar `0001_lista_espera.sql` nele.
3. Criar o cliente compartilhado em `packages/db`, e fazer os dois projetos
   lerem dele em vez de cada um ter o seu.
4. Só então a tela de login, e a sessão atravessando de `kingstable.com` para
   `app.kingstable.com`.

O subdomínio é o que permite a sessão atravessar: cookie de sessão em
`.kingstable.com` vale nos dois. Foi por isso que o subdomínio foi escolhido
em vez de `kingstable.com/app`.

## Dívidas que a unificação deixou de propósito

- **As versões de React não foram unificadas** (site 19.2.8, app 19.1.0),
  porque fixar exigiria mexer na landing. O Metro foi configurado para
  conviver com isso. Quando a landing puder ser tocada, unificar em 19.1.0.
- **A landing ainda não consome `packages/ui`.** Os tokens têm fonte única,
  mas com um consumidor só, então os valores seguem escritos em dois lugares
  (`packages/ui/tokens.ts` e `apps/site/app/globals.css`). Não é descuido:
  ligar a landing exigiria editar o `globals.css` dela.
- **`packages/core` está vazio.** Os módulos puros continuam em
  `apps/app/lib/`.
- **Sobras mortas no app**, não limpas de propósito para não misturar com a
  mudança de estrutura: `App.tsx` (template do Expo, não usado, o roteador
  entra por `index.ts`), `global.css` (resto do NativeWind) e
  `react-native-mmkv` instalado sem uso.
