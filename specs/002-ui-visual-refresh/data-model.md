# Data Model: Refinamento Visual da Interface

## Alterações de dados

Nenhuma. Esta feature não cria, altera nem remove tabelas, colunas, entidades, relações, políticas RLS, funções, migrations, dados de domínio ou dados de perfil.

## Dependência preservada

| Conceito existente | Papel na feature | Invariante de preservação |
|--------------------|-----------------|---------------------------|
| Preferência de cor de destaque do perfil | Seleciona a variação visual já disponível para a pessoa autenticada | Continuar limitada a Preto, Rosa e Verde, persistida e entregue no HTML sem depender de JavaScript. |

## Validação

- Não há novas regras de validação nem transições de estado.
- A implementação não deve chamar, modificar ou contornar a persistência da preferência; somente deve consumir os tokens resultantes dela.
