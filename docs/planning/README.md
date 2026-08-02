# Planejamento — Cadence

Registro das etapas de implementação: decisões de design, subtarefas e status. Cada
etapa vira um arquivo próprio nesta pasta, criado _antes_ da implementação e mantido
como histórico depois.

## Convenção

- Um arquivo por etapa: `etapa-NN-nome-curto.md`.
- Status possíveis: `planejado` · `em andamento` · `concluído` · `bloqueado`.
- Decisões de design, uma vez fechadas, não são reescritas — se mudarem depois, registra-se uma nova entrada de decisão com data, em vez de editar a original.

## Índice

| Etapa                          | Descrição                                                   | Status       |
| ------------------------------ | ----------------------------------------------------------- | ------------ |
| [01–03](../../CLAUDE.md)       | Bootstrap: scaffold Next.js, testes, CI, deploy Hello World | concluído    |
| [04](./etapa-04-schema-rls.md) | Schema Drizzle + Row-Level Security                         | em andamento |
| 05                             | _(a definir)_                                               | planejado    |
