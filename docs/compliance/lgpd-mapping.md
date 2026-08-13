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

## Base legal por finalidade (art. 7º)

| Finalidade                              | Dado                       | Base legal sugerida                                  |
| --------------------------------------- | -------------------------- | ---------------------------------------------------- |
| Autenticar o usuário                    | e-mail, nome (via Google)  | Execução de contrato (art. 7º, V) [REVISAR JURÍDICO] |
| Prover o serviço de controle financeiro | lançamentos, metas, contas | Execução de contrato [REVISAR JURÍDICO]              |
| Personalizar a interface                | cor de destaque do perfil  | Execução de contrato [REVISAR JURÍDICO]              |
| Segurança da conta                      | tokens de sessão           | Legítimo interesse [REVISAR JURÍDICO]                |

## Princípios (art. 6º) → implementação

- Minimização → não coletamos IP, geolocalização, dado sensível ou analytics.
- Necessidade → só o que é preciso para o serviço funcionar; a personalização guarda
  apenas um de três códigos fixos, sem histórico de alterações ou dado comportamental.
- Livre acesso → usuário pode ver e exportar seus dados (ver spec de portabilidade).
- Transparência → política de privacidade clara e acessível.
- Segurança → RLS, senha gerida pelo Auth, TLS, sem PII em log.

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
