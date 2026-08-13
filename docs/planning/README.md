# Planejamento — Cadence

Registro das etapas de implementação: decisões de design, subtarefas e status. Cada
etapa vira um arquivo próprio nesta pasta, criado _antes_ da implementação e mantido
como histórico depois.

## Convenção

- Um arquivo por etapa: `etapa-NN-nome-curto.md`.
- Status possíveis: `planejado` · `em andamento` · `concluído` · `bloqueado`.
- Decisões de design, uma vez fechadas, não são reescritas — se mudarem depois, registra-se uma nova entrada de decisão com data, em vez de editar a original.

## Índice

| Etapa                                    | Descrição                                                   | Status       |
| ---------------------------------------- | ----------------------------------------------------------- | ------------ |
| [01–03](../../CLAUDE.md)                 | Bootstrap: scaffold Next.js, testes, CI, deploy Hello World | concluído    |
| [04](./etapa-04-schema-rls.md)           | Schema Drizzle + Row-Level Security                         | concluído    |
| [05](./etapa-05-autenticacao.md)         | Autenticação (email/senha)                                  | concluído    |
| [06](./etapa-06-lancamento-dashboard.md) | Lançamento de despesas + Dashboard                          | concluído    |
| [07](./etapa-07-metas.md)                | Metas financeiras                                           | concluído    |
| [08](./etapa-08-contas-fixas.md)         | Contas fixas / recorrentes                                  | concluído    |
| [09](./etapa-09-fundacao-visual.md)      | Fundação visual (navegação + tokens + cor de destaque)      | concluído    |
| [10](./etapa-10-polimento-por-tela.md)   | Polimento visual por tela                                   | concluído    |
| [11](./etapa-11-experiencia-login.md)    | Experiência visual e acessível de login                     | concluído    |
| [12](./etapa-12-experiencia-mobile.md)   | Experiência mobile completa                                 | concluído    |
| [13](./etapa-13-refinamento-interacao.md) | Refinamento de interação, a11y e landing page               | concluído    |
