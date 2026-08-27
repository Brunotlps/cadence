# Mapeamento LGPD

Documento de rastreabilidade: liga cada princípio/exigência da LGPD a uma decisão
concreta de produto. `[REVISAR JURÍDICO]` marca pontos que precisam de validação de advogado.

## Papéis

- Controlador: [REVISAR JURÍDICO — nome/pessoa/empresa responsável pelos dados]
- Operadores (terceiros que processam dados em nosso nome):
  - Vercel (hospedagem) — verificar DPA e localização de dados
  - Supabase (banco + auth) — verificar DPA, região do projeto e transferência internacional
  - Google (provedor de identidade OAuth, desde a Etapa 16) — verificar DPA e
    transferência internacional [REVISAR JURÍDICO]; Cadence recebe só e-mail e nome
    do Google, nunca a senha da conta Google
  - Resend (entrega server-side de feedback autenticado) — recebe somente o tipo,
    mensagem, pathname normalizado opcional e, com opt-in por relato, o e-mail da
    sessão autenticada; verificar papel, base legal, DPA, subprocessadores,
    transferências, retenção e exclusão [REVISAR JURÍDICO]
  - Caixa administrativa restrita (destinatária do feedback) — recebe o mesmo
    conteúdo voluntariamente enviado; definir acesso mínimo, retenção e exclusão
    [REVISAR JURÍDICO]

## Fatos públicos da Resend — revisão de release

Revisão factual em 2026-08-25, usando somente fontes oficiais da Resend. Estes fatos
não determinam papéis, base legal ou suficiência jurídica para Cadence; essas decisões
permanecem `[REVISAR JURÍDICO]`.

| Tema | Fato público verificado | Fonte oficial |
| --- | --- | --- |
| Conteúdo, e-mail e logs | Durante conta ativa, a página GDPR informa retenção de dados de e-mail e logs por 30 dias nos planos Free, Pro e Scale; Enterprise tem retenção flexível. O dashboard permite ver detalhes, conteúdo e logs de e-mails enviados. | [GDPR](https://resend.com/security/gdpr), [Managing Emails](https://resend.com/docs/dashboard/emails/introduction) |
| Dados de conta/uso | A Resend declara processar dados de conta, cobrança e uso como controladora independente; sua política também descreve dados pessoais, cookies e dados de uso associados ao serviço/dashboard. A qualificação aplicável à Cadence permanece `[REVISAR JURÍDICO]`. | [GDPR](https://resend.com/security/gdpr), [Privacy Policy](https://resend.com/legal/privacy-policy) |
| DPA | A DPA está publicamente disponível; a documentação informa que a versão pré-assinada torna-se plenamente executada com a adesão à conta, sem contra-assinatura. A confirmação contratual aplicável permanece `[REVISAR JURÍDICO]`. | [DPA](https://resend.com/static/documents/resend-dpa-signed.pdf), [Compliance documents](https://resend.com/docs/knowledge-base/downloading-documents) |
| Subprocessadores | A lista pública identifica subprocessadores e localizações, incluindo AWS (hospedagem/envio), Cloudflare, Datadog e outros; a página GDPR informa aviso escrito de pelo menos 14 dias antes de adição/substituição. A revisão da lista vigente é humana e recorrente. | [Subprocessors](https://resend.com/legal/subprocessors), [GDPR](https://resend.com/security/gdpr) |
| Encerramento | A página GDPR informa exclusão do dado restante do cliente em até 90 dias após encerramento; o guia de exclusão diz que conta e dados associados entram na fila de exclusão permanente. A execução e a evidência de um encerramento real permanecem `[REVISAR JURÍDICO]`. | [GDPR](https://resend.com/security/gdpr), [Account deletion](https://resend.com/docs/knowledge-base/how-can-i-delete-my-resend-account) |
| Backups | Há conflito entre fontes oficiais: a página GDPR informa backups por 7 dias, enquanto a página Security informa backups de produção por 30 dias. Não assumir uma retenção única até esclarecimento formal da Resend; esse ponto permanece `[REVISAR JURÍDICO]`. | [GDPR](https://resend.com/security/gdpr), [Security](https://resend.com/docs/security) |
| Localização e transferências | Conteúdo, metadados de e-mail, logs, payloads de webhook e registros de conta são armazenados nos EUA, independentemente da região de envio. A página GDPR aponta SCCs, UK Addendum quando aplicável e EU-U.S. DPF como mecanismos descritos. A adequação para Cadence/LGPD permanece `[REVISAR JURÍDICO]`. | [GDPR](https://resend.com/security/gdpr), [Choosing a Region](https://resend.com/docs/dashboard/domains/regions) |
| Open/click tracking | Tracking de abertura e clique fica desativado por padrão para domínios; só fica ativo quando a configuração correspondente está habilitada e o subdomínio de tracking foi configurado/verificado. Em Production, T033 confirmou ambos desativados para o domínio de envio. | [Open and Click Tracking](https://resend.com/docs/dashboard/domains/tracking) |

Mensagem enviada em texto simples não elimina a retenção do provedor. A Resend também
documenta uma opção, sujeita a elegibilidade e suporte, para desativar armazenamento de
conteúdo de mensagens; a decisão de adotar ou não essa opção é operacional e jurídica,
não automática. [Message storage](https://resend.com/docs/knowledge-base/how-do-i-ensure-sensitive-data-isnt-stored-on-resend)

### Decisão humana — caixa administrativa

- O acesso é restrito ao maintainer e aos responsáveis autorizados do Cadence.
- Feedback recebido por e-mail tem retenção operacional máxima de 90 dias e deve ser
  excluído antes quando não for mais necessário.
- Retenção superior a 90 dias só é permitida para suporte ou incidente ativo, com
  justificativa registrada.
- O feedback não pode ser reutilizado para analytics, marketing ou perfilamento.
- A exclusão permanente deve usar o mecanismo disponível no provedor da caixa.

Permanecem `[REVISAR JURÍDICO]` a confirmação contratual/DPA aplicável, a resolução do
conflito de retenção de backups e as decisões de papel, base legal e adequação de
transferências para Cadence.

## Base legal por finalidade (art. 7º)

| Finalidade                              | Dado                       | Base legal sugerida                                  |
| --------------------------------------- | -------------------------- | ---------------------------------------------------- |
| Autenticar o usuário                    | e-mail, nome (via Google)  | Execução de contrato (art. 7º, V) [REVISAR JURÍDICO] |
| Prover o serviço de controle financeiro | lançamentos, metas, contas | Execução de contrato [REVISAR JURÍDICO]              |
| Personalizar a interface                | cor de destaque do perfil  | Execução de contrato [REVISAR JURÍDICO]              |
| Identificar membros dentro do próprio workspace | nome de exibição (`display_name`) e cor de destaque de colegas do mesmo workspace | Execução de contrato [REVISAR JURÍDICO] |
| Segurança da conta                      | tokens de sessão           | Legítimo interesse [REVISAR JURÍDICO]                |
| Limitar abuso de feedback autenticado   | janela, contador e expiração por conta | Legítimo interesse [REVISAR JURÍDICO] |
| Entregar feedback voluntário            | tipo, mensagem e contexto opcional; e-mail somente com opt-in | Execução de contrato ou legítimo interesse [REVISAR JURÍDICO] |

## Princípios (art. 6º) → implementação

- Minimização → não coletamos IP, geolocalização, dado sensível ou analytics.
- Necessidade → só o que é preciso para o serviço funcionar; a personalização guarda
  apenas um de três códigos fixos, sem histórico de alterações ou dado comportamental.
- Livre acesso → usuário pode ver e exportar seus dados (ver spec de portabilidade).
- Transparência → política de privacidade clara e acessível.
- Segurança → RLS, login sem senha própria (identidade delegada ao Google), TLS,
  sem PII em log.
- Feedback → Cadence não persiste conteúdo, pathname ou e-mail de feedback. Resend e
  a caixa administrativa são fronteiras externas sujeitas à revisão humana de ciclo
  de vida antes do release; tracking de abertura/clique deve permanecer desativado.
  O payload é texto simples com tipo, mensagem e pathname normalizado opcional; e-mail
  de retorno só segue com opt-in explícito e quando derivado no servidor. Não inclui
  URL completa, query, fragmento, dados financeiros, IDs internos de
  usuário/workspace, cookies, telemetria, logs ou estado de página. Aceitação pelo
  provedor é a fronteira de sucesso, não recebimento, leitura ou resposta pela caixa.
- Limite de feedback → `feedback_submission_limits` contém somente identificador de
  conta, janela ancorada, contador e expiração. A função autenticada
  `public.consume_feedback_submission_limit()` deriva `auth.uid()` e permite no máximo
  três aquisições válidas em 24 horas; validação falha antes da aquisição, enquanto
  toda aquisição válida consome vaga mesmo diante de rejeição do provedor ou retry
  ambíguo com a mesma chave. Não há decremento compensatório. A tabela usa RLS sem
  acesso direto; `public.cleanup_expired_feedback_submission_limits()` faz hard-delete
  físico pelo scheduler horário. Quando o job está implantado e operando corretamente,
  a remoção ocorre em aproximadamente uma hora de `expires_at`;
  `public.handle_account_deletion(uuid)` remove a linha por uma via independente na
  exclusão de conta.

## Evidência automatizada de implementação

- T028 — ambiente Supabase não produtivo autorizado, com 5/5 testes de conformidade
  aprovados: RLS/acesso direto, identidade derivada, atomicidade, expiração com
  hard-delete e remoção na exclusão de conta.
- T029 — execução Chromium autenticada autorizada, com 4/4 testes de feedback
  aprovados: rotas protegidas, diálogo, responsividade, acessibilidade e validação.
- Os testes automatizados não fizeram requisição real à Resend. Configuração do
  provedor, ciclo de vida da caixa administrativa e demais decisões legais continuam
  sujeitos a `[REVISAR JURÍDICO]` e às tarefas humanas de release.

## Direitos do titular (art. 18) → como atendemos

- Confirmação e acesso → tela de conta + exportação.
- Correção → usuário edita os próprios dados.
- Eliminação → botão de deletar conta com cascata real.
- Portabilidade → exportação em formato aberto (JSON/CSV).
- Informação sobre compartilhamento → seção na política listando operadores.

## Transferência internacional [REVISAR JURÍDICO]

Se Vercel/Supabase/Google armazenarem ou processarem fora do Brasil, verificar
adequação (art. 33). Preferir região de dados mais próxima e documentar a decisão.
Google, como provedor de identidade OAuth desde a Etapa 16, processa e-mail e nome
no momento do login — mesmo tratamento de verificação exigido dos demais operadores.

## Incidentes de segurança

Definir plano de resposta e prazo de comunicação à ANPD e aos titulares [REVISAR JURÍDICO].
