# Autenticacao web

## Implementacao de 16/09/2026

- Landing com botoes Entrar e Criar conta, sem alterar os efeitos do hero.
- `/login`, `/cadastro`, `/recuperar-senha` e `/nova-senha`.
- Supabase Auth com e-mail e senha, confirmacao por e-mail e fluxo PKCE.
- `/auth/callback` troca o codigo por sessao. O destino so pode ser
  `/acessar` ou `/nova-senha`, nunca uma URL fornecida pelo usuario.
- `/acessar` valida a identidade com `getUser` antes de redirecionar ao app.
- Site e app web usam `@supabase/ssr` e o mesmo projeto Supabase. Nao ha
  tokens na URL, service_role no navegador, checkout ou ativacao de planos.
- O app web verifica a identidade antes de renderizar as telas. No Perfil,
  exibe nome, e-mail e Sair da conta. O app nativo continua fora desta etapa.
- Mesas, presets e relogios locais usam chaves separadas por ID da conta.
  As chaves antigas sem conta permanecem intactas, sem atribuir dados antigos
  automaticamente a quem fizer o primeiro login.
- A autenticacao nao implementa sincronizacao de mesas nem substitui RLS.

## Configuracao

Durante desenvolvimento em localhost, clicar em Entrar no sistema com os
dois campos vazios abre um modo de teste local. A URL usa `?teste=1`; o app
mantem esse modo na sessao da aba e separa os dados em `preview-local`.
Sair do teste volta ao login. Nao cria usuario, tokens nem acesso ao banco.
O formulario e o app bloqueiam este caminho em builds de producao e fora
dos hostnames localhost e 127.0.0.1. Campos preenchidos usam o login real.
Playwright validou entrada vazia, atualizacao e saida no desenvolvimento.
Nos builds de producao, o formulario vazio nao avancou e a URL direta
`?teste=1` no app voltou ao login, sem liberar as telas.

Os `.env.local` foram recuperados localmente e continuam ignorados pelo Git.
Em outra maquina ou no deploy, configurar:

Site, `apps/site/.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA
NEXT_PUBLIC_APP_URL=http://localhost:8081/
```

App, `apps/app/.env.local`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
EXPO_PUBLIC_SITE_URL=http://localhost:3001
```

Usar o mesmo hostname nos previews (localhost nos dois, nao misturar com
127.0.0.1). Cookies nao sao separados por porta; localStorage e separado.

Para dominios de producao diferentes, configurar HTTPS e os enderecos reais.
Se forem subdominios do mesmo dominio, definir nas duas aplicacoes o mesmo
dominio de cookie: `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN` no site e
`EXPO_PUBLIC_AUTH_COOKIE_DOMAIN` no app. Nao definir dominio em localhost.
Dominios sem uma raiz comum nao compartilham esta sessao automaticamente.

No Supabase Auth, habilitar e-mail e senha e cadastrar na lista de Redirect
URLs ambos estes enderecos locais e os equivalentes de producao:

- `http://localhost:3001/auth/callback`
- `http://localhost:3001/auth/callback?destino=senha`

Configurar o Site URL e SMTP de producao antes de abrir cadastros publicos.
O link PKCE deve ser aberto no mesmo navegador onde o fluxo foi iniciado.

## Verificacao

- Revisao de concorrencia em 16/09: carregamento dos tres stores serializado,
  falha de hidratacao bloqueia acesso e verificacoes Auth antigas nao liberam
  a UI. teste-contas cobre leitura lenta, falha e recuperacao sem apagar dados.
  Playwright com resposta Auth atrasada/simulada conferiu a conta B isolada;
  captura mobile inspecionada e sem overflow. Isso nao valida Auth positivo real.
- TypeScript do site e app, build Next, export Expo web e nove suites passaram,
  incluindo o novo teste de isolamento, restauracao e preservacao por conta.
- Playwright: login desktop e cadastro mobile sem overflow, mostrar senha,
  bloqueio de senhas diferentes, credenciais invalidas contra o Supabase real.
- Acesso direto ao app sem sessao voltou ao login; `/acessar` sem identidade e
  callback invalido tambem foram rejeitados.
- Com respostas Auth simuladas apenas no navegador de QA, a sessao em cookie
  foi reconhecida pelo app e uma mesa foi salva na chave da conta A. A conta B
  nao viu essa mesa, e os dados da conta A permaneceram salvos.
- Nenhuma conta ficticia foi criada no banco. O fluxo positivo completo de
  e-mail real, confirmacao, login, renovacao e recuperacao ainda precisa ser
  validado com uma conta real e os redirects configurados no Supabase.
- Auth settings respondeu HTTP 200, e-mail habilitado e confirmacao exigida.
- Os avisos de search_path e EXECUTE publico em `handle_new_user` foram
  corrigidos na etapa posterior de copia online, junto das policies de
  perfis, torneios, membros e comprovantes. Advisors sem alertas nessa
  verificacao; nenhuma migracao foi aplicada na etapa de autenticacao em si.
