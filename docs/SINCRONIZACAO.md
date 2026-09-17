# Sincronizacao do dominio

Contrato de implementacao, 16/09/2026. Nao representa recurso entregue.
Referencias de escopo: CHECKLIST.md, especialmente D03, F018/F019 e F082.

## Evidencia atual

- Stores locais persistem torneios completos, presets e relogios por conta.
- Trocas de conta sao serializadas; falha de hidratacao impede liberar a UI.
- AuthGate descarta verificacoes antigas e oculta a conta anterior na troca.
- Supabase consultado em 16/09: tournaments/tournament_players usam UUIDs.
  Novas entidades locais agora usam UUID v4; IDs legados t_*/p_* permanecem
  intactos. Nao enviar esses valores legados para colunas UUID sem mapeamento.
- Identidade web usa crypto.randomUUID; nativo usa expo-crypto 15.0.9
  compativel com SDK 54. Web requer contexto seguro (HTTPS ou localhost).
  Convidados continuam guest_*: nao sao perfis Auth, mesmo quando a inscricao
  tem UUID. Um UUID de inscricao nao comprova vinculo com conta autenticada.
- Identidade dos novos registros validada em testes e criacao real na UI
  web, com reload e capturas 390/1440 inspecionadas. Nativo ainda nao foi
  validado em aparelho. Fila e recibos de operacoes ainda nao existem.
- As quatro versoes aplicadas estao em packages/db/supabase/migrations;
  inicial reconstruida a partir dos 53 statements do historico remoto.
  Copias antigas preservadas. Replay em banco novo ainda nao validado.
- tournaments remoto tem current_level/seconds_remaining, mas nao possui
  ancora temporal, revisao ou hand-for-hand. Tambem nao representa campos
  locais de assentos, convidados, acertos e auditoria.
- Policies atuais de tournaments restringem criador/membros; isso nao
  concede permissao de escrita a co-hosts nem cria leitura por QR Code.
- account_backups guarda uma copia manual. Nao e o dominio sincronizado.
- Nenhuma migracao remota ou escrita de dados ocorreu nesta verificacao.

## Invariantes obrigatorias

1. Servidor confirma identidade e autorizacao em toda operacao. Dono vem
   da identidade autenticada, nunca de createdBy enviado pelo navegador.
2. Cada entidade nova e operacao tem identidade global independente do
   horario do aparelho. Registros legados mantem IDs locais ate migracao
   confirmada, com mapeamento persistido e sem troca silenciosa de referencias.
3. Uma operacao tem ID imutavel, ator, alvo, tipo, payload e revisao esperada.
   Reenvio do mesmo ID/payload devolve o mesmo resultado, sem duplicar efeitos.
   Mesmo ID com outro payload e erro, nunca uma nova operacao.
4. Transacao grava mudanca, revisao, recibo idempotente e auditoria juntos.
   Falha em qualquer parte nao deixa jogadores/financeiro/relogio parciais.
5. Conflito de revisao nao aceita last-write-wins de um torneio inteiro.
   Mudancas compativeis podem ser reaplicadas sobre a versao atual usando
   regras do dominio; conflito financeiro/eliminacao exige revisao explicita.
6. Fila offline e persistida antes do envio, isolada por conta. Trocar de
   conta/logout interrompe envios; resposta antiga nao muda a conta atual.
   Nao descartar operacoes pendentes ao atualizar cache ou restaurar backup.
7. Confirmacao remota remove apenas a operacao correspondente. Timeout
   apos commit reenvia o mesmo ID; nao presume que a escrita foi rejeitada.
8. Realtime informa mudancas, nao e a unica fonte de verdade. Reabrir,
   recuperar conexao ou perder eventos consulta revisoes no servidor.
9. Exclusao usa registro de remocao/revisao antes de qualquer limpeza;
   um dispositivo atrasado nao pode ressuscitar uma mesa excluida.
10. Validacao do dominio acontece no servidor tambem. UI desabilitada e
    validacao Zod no cliente nao substituem integridade e autorizacao.

## Relogio compartilhado

- Estado autoritativo por torneio: estrutura versionada, nivel, estado
  rodando/pausado/congelado, tempo pausado, ancora de fim e revisao.
- Comandos start/pause/retomar/saltar/congelar usam transacao e hora do
  servidor. Ticks de renderizacao nao fazem escritas por segundo.
- Clientes estimam diferenca de horario com o servidor, recalculam ao
  reconectar e exibem perda de conexao. TV e jogadores nao criam um segundo
  relogio autoritativo nem avancam a estrutura por conta propria.
- Comandos offline pendentes sao visiveis como pendentes; nao apresentar
  como confirmado um controle que as outras telas ainda nao receberam.
- Hand-for-hand completo inclui coordenacao das rodadas multimesa, nao
  apenas a pausa local que existe hoje.

## Permissoes e projecoes

- Dono gerencia a noite e os acessos; co-host tem permissao explicita por
  noite. Participante ve apenas os dados permitidos da propria inscricao.
- TV/espectador recebem uma projecao somente leitura. QR Code publico nao
  deve expor contatos, comprovantes, acertos privados ou auditoria interna.
- Links de acesso sao revogaveis e nao equivalem a service_role. Nao usar
  user_metadata para conceder privilegios ou autorizar escrita.
- Escrita que exige revisao/auditoria passa pelo contrato transacional;
  grants de escrita direta nao podem permitir contornar esse contrato.

## Sequencia de implementacao

1. Consolidar historico local/remoto das migracoes e criar identidade global
   para novas entidades/operacoes, sem modificar dados existentes.
2. Estender modelo normalizado para representar todos os campos locais;
   criar recibos, revisoes, tombstones e regras transacionais de permissao.
3. Integrar fila/cache por conta aos comandos reais dos stores. Migrar dados
   locais explicitamente, com copia anterior, mapeamento e retomada idempotente.
4. Integrar leitura inicial, comandos, reconciliacao e Realtime. Implementar
   estados de enviando, offline, erro de permissao e conflito na interface.
5. Integrar relogio autoritativo e modo TV remoto; depois projecoes QR/RSVP.
   Presets e demais entidades tambem entram no contrato, nao so torneios.

## Portas de validacao

- Unitarios: regras/reaplicacao, fila persistida, troca de conta, timeouts,
  payload duplicado, conflitos e referencias legadas.
- Banco: RLS allow/deny para anon/dono/co-host/participante/estranho;
  recibos e auditoria atomicos; concorrencia real de duas transacoes.
- Navegador: duas contas reais, dois dispositivos da mesma noite, login,
  renovacao, logout, offline/reload/reconexao e conflito financeiro.
- Relogio: diferenca de hora entre aparelhos, pausa/salto/congelamento,
  intervalos, TV somente leitura e recuperacao apos suspensao.
- Simulacao de Auth comprova comportamento da UI, nao valida e-mail, JWT,
  redirects, SMTP ou isolamento end-to-end de contas reais.
- Nenhum gate amplo vira validado por export/build ou consulta administrativa.

Referencia de seguranca: https://supabase.com/docs/guides/database/postgres/row-level-security
Callback Auth permanece sincrono, com verificacao agendada fora dele:
https://supabase.com/docs/guides/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0
