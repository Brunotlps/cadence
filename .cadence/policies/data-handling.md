# Política de tratamento de dados — guardrails de implementação

Regras vinculantes para qualquer código escrito neste projeto. Um agente de IA ou
desenvolvedor deve tratar estas regras como restrições rígidas, não sugestões.

## 1. Dados que NÃO devem ser coletados ou armazenados

- Endereços IP (nem em logs de aplicação, nem em tabelas). Se um serviço de terceiro
  (Vercel, Supabase) registra IP na sua própria infraestrutura, isso é tratado no DPA
  do fornecedor — não replicar esse armazenamento na nossa base.
- Dados de geolocalização.
- Qualquer categoria de dado sensível (art. 5º, II da LGPD): origem racial, convicção
  religiosa, opinião política, saúde, vida sexual, biometria. O produto não tem razão
  de negócio para isso.
- Analytics comportamental de terceiros no MVP. Sem GA, sem pixels de rastreio.

## 2. Dados coletados (mínimo necessário)

- Identidade do Google, via login OAuth (desde a Etapa 16): e-mail e nome. Cadence
  não recebe, não pede e não armazena senha — a senha da conta é gerida inteiramente
  pelo Google, fora do nosso controle e da nossa responsabilidade.
- Perfil pessoal mínimo: nome de exibição (preenchido a partir do nome da conta
  Google no primeiro login, editável depois) e preferência funcional de cor de
  destaque, restrita a Preto, Rosa ou Verde. Esses campos pertencem à própria pessoa
  e são isolados por `profiles.id = auth.uid()`, não por workspace.
- Dados financeiros inseridos pelo próprio usuário (lançamentos, metas, contas).
- Dados financeiros são sempre vinculados a um `workspace_id`.
- Não importamos foto de perfil (avatar) nem qualquer outro dado do Google além de
  e-mail e nome — minimização deliberada, não uma limitação técnica.

## 3. Cookies

- Apenas cookies estritamente necessários (sessão/autenticação).
- Enquanto não houver analytics, NÃO implementar banner de consentimento — cookies
  necessários são isentos. Se analytics entrar no futuro, exige opt-in explícito ANTES
  de qualquer script de rastreio carregar.

## 4. Isolamento de workspace

- Toda tabela de domínio ou dado financeiro vinculada a usuário DEVE ter coluna
  `workspace_id`; essa regra normal de isolamento não é enfraquecida por exceções de
  metadados de conta.
- Metadado estritamente de segurança/controle em nível de conta só é permitido sem
  `workspace_id` quando sua finalidade for inerentemente da conta, não contiver dado
  financeiro/de domínio ou de workspace, tiver processamento limitado à finalidade,
  fronteiras de acesso ao banco e de menor privilégio explícitas, e retenção,
  hard-delete e comportamento na exclusão da conta documentados.
- `feedback_submission_limits` é uma exceção específica e limitada para prevenir abuso
  de feedback autenticado. Contém somente `user_id`, início de janela ancorada,
  contador e expiração; não contém texto de feedback, e-mail, pathname, IP, dado de
  workspace, dado financeiro ou analytics. A função autenticada
  `consume_feedback_submission_limit()` deriva a identidade exclusivamente de
  `auth.uid()`: janela ancorada de 24 horas, no máximo três tentativas válidas que
  adquiriram vaga, e toda aquisição consome uma vaga, inclusive retry ambíguo com a
  mesma chave, sem decremento compensatório após falha do provedor. Falhas de
  validação anteriores à aquisição não consomem vaga. A limpeza
  `cleanup_expired_feedback_submission_limits()` é restrita ao scheduler do banco;
  linhas expiradas são sujeitas a hard-delete físico pelo job horário. Quando esse job
  está implantado e operando corretamente, a remoção ocorre em aproximadamente uma
  hora de `expires_at`; `public.handle_account_deletion(uuid)` é uma via independente
  de hard-delete desse metadado na exclusão da conta.
- Toda tabela com dado de usuário DEVE ter RLS habilitado e nenhuma query pode depender
  apenas de filtro na aplicação para isolar dados.
- Chaves de service-role do Supabase (que ignoram RLS) NUNCA são expostas ao cliente
  e só são usadas em rotinas administrativas explicitamente auditadas.

## 5. Apagamento de conta

- Deletar conta é irreversível e apaga em cascata todos os dados do usuário.
- Se o usuário for o último membro de um workspace, o workspace e todos os seus dados
  (lançamentos, metas, contas fixas) são apagados junto.
- Nada de "soft delete" que preserve dados pessoais indefinidamente sob o disfarce de
  exclusão. Um soft-delete de curtíssimo prazo (ex: janela de segurança de dias) é
  aceitável apenas se documentado e comunicado ao usuário.

## 6. Logs

- Logs de aplicação não devem conter dados pessoais nem valores financeiros.
- Proibido logar corpo de request/response que contenha dados do usuário.
- Erros logam identificadores opacos (ex: `workspace_id`), nunca conteúdo.

## 7. Feedback autenticado e entrega externa

- Cadence não persiste conteúdo, e-mail, pathname ou chave de idempotência de
  feedback no banco. O limiter armazena somente o metadado temporário descrito acima.
- A entrega externa recebe texto simples com tipo, mensagem e pathname normalizado
  opcional. E-mail de retorno só é incluído após opt-in explícito e é derivado no
  servidor da sessão autenticada.
- O payload externo nunca inclui URL completa, query, fragmento, dados financeiros,
  IDs internos de usuário ou workspace, cookies, telemetria, logs ou estado de
  página. Conteúdo e e-mail de feedback também não entram em logs ordinários.
- Sucesso significa aceitação pelo provedor; não significa recebimento, leitura ou
  resposta pela caixa administrativa. Papéis, base legal, retenção e eliminação da
  Resend e da caixa administrativa permanecem `[REVISAR JURÍDICO]`.
