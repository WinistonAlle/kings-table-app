# Autenticacao web

## Renovacao Local Em 23/09/2026

- Chrome em localhost:3302 com GoTrue local e conta temporaria confirmada.
  Depois do login real, o cookie compartilhado do site/app recebeu um
  `expires_at` passado, sem alterar a assinatura do JWT nem o refresh token.
  Uma requisicao direta a `/acessar`, sem JavaScript do app, retornou 307
  para `/app` e `Set-Cookie`; access token e refresh token foram renovados,
  com nova expiracao futura. O app abriu autenticado na mesma origem.
- Com `expires_at` passado e refresh token invalido, `/acessar` retornou 307
  para `/login`, limpou o cookie e a navegacao direta para `/app` tambem
  terminou no login. Captura mobile
  `output/playwright/auth-invalid-refresh-mobile.png` inspecionada em 390x844,
  sem overflow. Conta temporaria removida, sem publicacao ou alteracao remota.
- Isto valida a renovacao acionada por metadados de sessao expirados e o erro
  de refresh no ambiente local. Nao simula um JWT realmente vencido, nem
  confirma e-mail, recuperacao de senha, SMTP ou dominio de producao.

## Mesmo Dominio Em 22/09/2026

- O export web do Expo e servido em `/app` pelo Next. `/acessar` valida a
  identidade e envia para `/app` na mesma origem; ao sair, o app retorna para
  `/login` dessa origem. Nao depende mais de `NEXT_PUBLIC_APP_URL` nem da
  porta separada 8081 para a sessao do site.
- O modo de teste continua disponivel no desenvolvimento local, inclusive
  quando o app em `/app` e um export estatico. Ele so abre em localhost ou
  127.0.0.1 e usa armazenamento local separado, sem conta no backend.
- Chrome em servidor isolado localhost:3302 validou login real por senha com
  GoTrue local, cookie aceito pelo app, `/acessar`, logout e retorno ao login.
  Em localhost:3301, verificou modo de teste, criar mesa, saida e bloqueio de
  `/app` sem sessao; capturas em 390x844 e 1440x900 inspecionadas. `3001`
  pertencia a outro projeto durante esta rodada e nao foi alterada.
- Cadastro com e-mail de confirmacao, renovacao e recuperacao, URL publica
  e SMTP seguem sem validacao positiva completa. O teste local usa contas
  temporarias confirmadas pelo admin apenas para QA, removidas ao final.

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
O formulario oferece o atalho apenas no servidor de desenvolvimento. O app
exportado aceita `?teste=1` somente nos hostnames localhost e 127.0.0.1;
no dominio publico esse caminho nao libera as telas. Campos preenchidos
usam o login real. O modo de teste nao cria usuario nem envia comandos online.

Os `.env.local` foram recuperados localmente e continuam ignorados pelo Git.
Em outra maquina ou no deploy, configurar:

Site, `apps/site/.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA
```

App, `apps/app/.env.local`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
EXPO_PUBLIC_SITE_URL=http://localhost:3001
```

O site serve o export web em `/app` no mesmo dominio. `/acessar` redireciona
para `/app` somente depois de validar a conta, e o app retorna para `/login`
na mesma origem. Em outra porta, configurar `EXPO_PUBLIC_SITE_URL` para a
landing correspondente ao usar o app Expo separadamente. Cookies nao sao
separados por porta; localStorage e separado.

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

- Em 01/10, o gate web passou a limitar a espera por identidade e hidratacao
  a 12 s, com mensagem de erro e retry. Abortar a espera invalida o resultado,
  sem afirmar que a chamada do SDK foi cancelada. Identidade antiga nao abre
  a conta depois do limite. O modo de teste local tambem tem espera limitada.
- Runner `browser-access-deadline-code.js` no Chromium, com contas temporarias
  e login por senha reais no Supabase local: HTTP 200 retido ate o timeout,
  liberacao atrasada sem desbloquear UI, retry recuperado; HTTP 503 bloqueado
  e retry recuperado. Cookies e localStorage identicos apos hidratacao.
  Capturas mobile/desktop inspecionadas. Isto nao valida cadastro por e-mail,
  SMTP, expiracao real de JWT, remoto, outros browsers ou fontes travadas.
  As afirmacoes historicas sobre ausencia de contas ficticias abaixo dizem
  respeito a etapa original; as contas temporarias desta verificacao sao
  somente locais e removidas ao terminar.

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
