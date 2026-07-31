# Testes de conformidade

Provam, de forma automatizada, que os guardrails de privacidade e isolamento são
respeitados. Devem rodar no CI e bloquear merge se falharem.

Cobertura mínima:

- RLS impede acesso cruzado entre workspaces (leitura e escrita).
- Apagar workspace apaga em cascata transações, contas fixas e metas.
- Apagar conta remove participações e apaga workspaces órfãos.
- Exportação só retorna dados do próprio usuário.
- Nenhum endpoint retorna dados sem sessão autenticada.
