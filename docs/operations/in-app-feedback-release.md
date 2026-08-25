# Runbook de release: feedback no aplicativo

Este runbook descreve a configuração e a operação do feedback autenticado. Ele não
autoriza alterações de produção por si só: as verificações marcadas como release ou
humanas exigem a aprovação aplicável. Não registrar conteúdo de feedback, e-mail de
follow-up, valores de variáveis ou segredos nas evidências operacionais.

## 1. Configuração única antes da release

### Resend e remetente

Configure exclusivamente no ambiente de servidor, nunca no navegador, controle de
versão ou logs:

- `RESEND_API_KEY`
- `FEEDBACK_FROM_EMAIL`
- `FEEDBACK_RECIPIENT_EMAIL`

Antes da release, o responsável deve:

1. Verificar o domínio/remetente de `FEEDBACK_FROM_EMAIL`, incluindo os registros DNS
   exigidos pela Resend, e registrar somente o estado de verificação, não valores ou
   credenciais.
2. Confirmar que `FEEDBACK_RECIPIENT_EMAIL` é uma caixa administrativa de acesso
   restrito e que os seus controles de acesso seguem o menor privilégio.
3. Confirmar que open tracking e click tracking estão desativados para o domínio de
   envio.
4. Confirmar a configuração de entrega plaintext: sem anexos, sem tags ou telemetria
   adicionadas pelo Cadence. O corpo aprovado contém somente tipo, mensagem e pathname
   normalizado opcional.

O `reply_to` só pode ser o e-mail autenticado derivado no servidor quando houver
opt-in explícito por relato. IDs internos de usuário ou workspace, URL completa,
query, fragmento, contexto financeiro, cookies, estado de página, telemetria e dados
de diagnóstico não fazem parte da requisição ao provedor.

O sucesso exibido pela aplicação significa que a Resend aceitou a API. Não significa
entrega na caixa, leitura ou reconhecimento humano.

### Gate de privacidade e ciclo de vida

Antes da release, concluir ou manter explicitamente pendente a revisão de:

- retenção de conteúdo no produto/dashboard do provedor;
- DPA, subprocessadores e dados de conta/uso;
- transferências internacionais aplicáveis;
- comportamento de encerramento da conta e eliminação no provedor;
- acesso, retenção e eliminação na caixa administrativa.

Papéis, base legal e decisões sobre esses itens permanecem
`[REVISAR JURÍDICO]` até a aprovação humana documentada. Cadence não persiste o
conteúdo do feedback como conjunto de dados da aplicação; isso não resolve, nem
substitui, o ciclo de vida independente da Resend ou da caixa administrativa.

## 2. Verificação de release

### Objetos do banco e fronteiras de privilégio

Após aplicar a migração aprovada no ambiente-alvo, um operador com acesso administrativo
ao banco pode verificar, sem expor dados de usuários, que existem:

- a tabela `public.feedback_submission_limits`;
- `public.consume_feedback_submission_limit()`;
- `public.cleanup_expired_feedback_submission_limits()`;
- a versão atualizada de `public.handle_account_deletion(uuid)`.

Consultas de verificação sugeridas (somente leitura):

```sql
SELECT to_regclass('public.feedback_submission_limits');

SELECT to_regprocedure('public.consume_feedback_submission_limit()'),
       to_regprocedure('public.cleanup_expired_feedback_submission_limits()'),
       to_regprocedure('public.handle_account_deletion(uuid)');

SELECT
  has_table_privilege('authenticated', 'public.feedback_submission_limits', 'SELECT') AS authenticated_select,
  has_table_privilege('authenticated', 'public.feedback_submission_limits', 'INSERT') AS authenticated_insert,
  has_table_privilege('authenticated', 'public.feedback_submission_limits', 'UPDATE') AS authenticated_update,
  has_table_privilege('authenticated', 'public.feedback_submission_limits', 'DELETE') AS authenticated_delete,
  has_function_privilege('authenticated', 'public.consume_feedback_submission_limit()', 'EXECUTE') AS authenticated_can_consume,
  has_function_privilege('authenticated', 'public.cleanup_expired_feedback_submission_limits()', 'EXECUTE') AS authenticated_can_cleanup,
  has_function_privilege('anon', 'public.cleanup_expired_feedback_submission_limits()', 'EXECUTE') AS anon_can_cleanup,
  has_function_privilege('service_role', 'public.cleanup_expired_feedback_submission_limits()', 'EXECUTE') AS service_role_can_cleanup;
```

O resultado esperado é `authenticated_select`, `authenticated_insert`,
`authenticated_update` e `authenticated_delete` todos como `false`,
`authenticated_can_consume = true`, e todas as permissões de cleanup acima como
`false`. A aquisição autenticada deriva a conta por `auth.uid()` e é a única função de
limiter disponível ao papel autenticado. Cleanup não recebe RPC, API HTTP ou caminho
de runtime da aplicação: o scheduler e a administração do banco são as fronteiras
pretendidas.

Confirme também, pela definição implantada ou metadados de migração, que o limiter
mantém janela ancorada de 24 horas e máximo de três aquisições válidas. Falha de
validação não adquire vaga; toda aquisição válida a consome, inclusive retry ambíguo
com a mesma chave, sem decremento compensatório após qualquer falha de entrega.

### Cron de limpeza

A migração `0015_feedback_submission_limits.sql` define o job idempotente:

| Campo | Valor esperado |
| --- | --- |
| Nome | `cleanup_feedback_submission_limits_hourly` |
| Agenda | `0 * * * *` |
| Comando | `SELECT public.cleanup_expired_feedback_submission_limits()` |

Verifique a extensão, o job e o estado ativo com acesso administrativo:

```sql
SELECT extname FROM pg_extension WHERE extname = 'pg_cron';

SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'cleanup_feedback_submission_limits_hourly';
```

Registre para a release a saída sanitizada que confirme nome, agenda, comando e
`active = true`, além da data/hora e do ambiente. O job submete linhas expiradas a
hard-delete físico; quando está implantado e operando corretamente, a remoção ocorre
em aproximadamente uma hora de `expires_at`. A exclusão de conta é uma via independente
de hard-delete por `public.handle_account_deletion(uuid)`.

A prova determinística de semântica da função de cleanup é distinta da prova de que o
cron está realmente implantado e saudável. A primeira já foi obtida em T028; a segunda
permanece a verificação operacional/release T034.

### Evidência já concluída

- **T028:** ambiente Supabase não produtivo autorizado; 5/5 testes hosted de
  `feedback_submission_limits` aprovados para RLS, identidade derivada, atomicidade,
  limpeza de expiração e exclusão de conta. Não houve requisição à Resend.
- **T029:** ambiente Chromium autenticado autorizado; 4/4 testes de feedback
  aprovados para rotas protegidas, diálogo, acessibilidade, responsividade e validação
  do cliente. Nenhum caminho válido de entrega ao provedor foi invocado e não houve
  requisição à Resend.
- **T033:** em Production, `RESEND_API_KEY`, `FEEDBACK_FROM_EMAIL` e
  `FEEDBACK_RECIPIENT_EMAIL` estão configuradas somente no servidor. O domínio e o
  remetente da Resend estão verificados e aptos para envio, com DKIM/SPF verificados;
  open tracking e click tracking estão desativados. O destinatário configurado é a
  caixa administrativa pretendida, com acesso restrito ao maintainer e responsáveis
  do Cadence. A entrega permanece plaintext, sem anexos, tags ou telemetria adicionada
  pelo Cadence. Nenhum valor de variável, endereço de e-mail ou segredo foi registrado.
- **T034:** a migration `0015_feedback_submission_limits.sql` foi aplicada e
  verificada em Production. `pg_cron` está ativo e o job
  `cleanup_feedback_submission_limits_hourly` está ativo, com agenda `0 * * * *` e
  comando `SELECT public.cleanup_expired_feedback_submission_limits()`. Foi observada
  uma execução real bem-sucedida, sem falhas na evidência recente. O maintainer do
  Cadence é o responsável operacional: inspeciona falhas semanalmente e
  `cron.job_run_details` mensalmente; a retenção operacional aprovada é de 30 dias e
  a poda mensal usa somente evidência sanitizada.
- **T035:** aceitação manual autenticada concluída em Production pelo alias público da
  aplicação. A feature foi mergeada em `main` no commit
  `df13c64238c9b66d3db1da7ac634db2ab3040844`; o deployment Production desse merge foi
  validado, assim como o smoke público de login e proteção de rota. Autenticação,
  navegação, launcher, diálogo e validação funcionaram; uma única submissão válida e
  não sensível retornou sucesso na UI após aceitação pelo provedor. O usuário
  permaneceu no Cadence e o fluxo terminou em menos de dois minutos. A evidência não
  registra e-mail, identificadores, segredos ou conteúdo do payload; sucesso significa
  aceitação pelo provedor, não entrega ou leitura na caixa.

Essa evidência não comprova entrega real pela Resend, DNS/remetente de produção,
operação do cron de produção, recebimento na caixa ou aprovação jurídica/privacidade.

## 3. Monitoramento e manutenção recorrentes

1. Inspecione execuções recentes e falhas do job:

   ```sql
   SELECT jobid, status, start_time, end_time, return_message
   FROM cron.job_run_details
   WHERE jobid = (
     SELECT jobid FROM cron.job
     WHERE jobname = 'cleanup_feedback_submission_limits_hourly'
   )
   ORDER BY start_time DESC
   LIMIT 50;
   ```

2. Depois de upgrades, reparos ou alterações da plataforma de banco, repita a
   verificação de extensão, job, agenda, comando e `active` da seção anterior.
3. O maintainer do Cadence é o responsável operacional. Inspeciona falhas semanalmente
   e `cron.job_run_details` mensalmente. `pg_cron` não remove automaticamente esse
   histórico: a retenção operacional aprovada é de 30 dias e a poda mensal deve manter
   apenas evidência sanitizada; não executar poda ampla fora desse escopo.

## 4. Incidentes e reparo

### Job ausente ou desativado

1. Investigue implantação, upgrade ou reparo de banco; confirme que a extensão
   `pg_cron` está disponível.
2. Verifique primeiro se já existe job com o nome esperado. Se existir com
   `active = false`, reative o job existente apenas com autorização administrativa:

   ```sql
   SELECT cron.alter_job(
     (
       SELECT jobid
       FROM cron.job
       WHERE jobname = 'cleanup_feedback_submission_limits_hourly'
     ),
     active := true
   );

   SELECT jobid, jobname, schedule, command, active
   FROM cron.job
   WHERE jobname = 'cleanup_feedback_submission_limits_hourly';
   ```

   Confirme que nome, agenda, comando e `active = true` permanecem os esperados. Se o
   job estiver genuinamente ausente, recrie o job nomeado definido pela migração 0015:

   ```sql
   SELECT cron.schedule(
     'cleanup_feedback_submission_limits_hourly',
     '0 * * * *',
     'SELECT public.cleanup_expired_feedback_submission_limits()'
   );
   ```

3. Capture evidência sanitizada de job ativo e acompanhe a próxima execução. Não crie
   RPC, endpoint HTTP ou permissão de papel da aplicação para executar cleanup.

### Falhas repetidas de cleanup

1. Consulte `cron.job_run_details` para o job específico e mantenha mensagens/saídas
   que possam conter dados fora de logs ordinários da aplicação.
2. Verifique extensão, agenda, comando, permissões e mudanças recentes de plataforma.
3. Corrija somente pela administração do banco aprovada; depois confirme uma execução
   bem-sucedida e registre a causa e a correção sanitizadas.

### Configuração ou entrega do provedor

- **Variáveis ausentes ou incorretas:** valide presença e escopo server-only de
  `RESEND_API_KEY`, `FEEDBACK_FROM_EMAIL` e `FEEDBACK_RECIPIENT_EMAIL`, sem revelar
  valores. Verifique remetente/domínio e restrição de acesso ao destinatário.
- **Rejeição do provedor:** a aplicação retorna erro seguro genérico. Corrija a
  configuração no ambiente autorizado; não exponha detalhes do provedor ao usuário e
  não devolva a vaga do limiter já adquirida.
- **Falha de transporte ambígua:** a interface pode reutilizar a mesma chave somente
  para payload canônico inalterado. Ainda assim, a nova invocação válida adquire e
  consome outra vaga; não há decremento compensatório.
- **Conflito de idempotência:** a aplicação retorna erro seguro genérico e a próxima
  submissão usa uma nova chave. Não interpretar o conflito como confirmação de entrega.

## 5. Gates humanos e de release pendentes

Os gates T032–T035 foram concluídos. Marcadores `[REVISAR JURÍDICO]` remanescentes
continuam exigindo governança jurídica, mas não impedem esta release conforme o escopo
das tarefas aprovadas.
