# Spec: portabilidade e exportação de dados

Atende ao direito de portabilidade (art. 18, V) e ao livre acesso (art. 6º, IV).

## Requisito

O usuário pode exportar, a qualquer momento e sem custo, todos os dados do(s)
workspace(s) de que participa, em formato aberto e legível por máquina.

## Formato

- JSON (estruturado, para reimportação) e/ou CSV (por entidade, para planilha).
- Sem campos internos irrelevantes (chaves técnicas podem ser mantidas, mas o foco é
  o dado do usuário: lançamentos, metas, contas fixas, membros do workspace).

## Escopo

- Exporta apenas dados dos workspaces em que o solicitante é membro (respeita RLS).
- Não inclui hash de senha nem tokens (dados de autenticação não são exportáveis).

## Fluxo

1. Usuário aciona "Exportar meus dados" nas configurações.
2. Backend gera o pacote lendo com a sessão do próprio usuário (RLS ativo).
3. Entrega como download direto (sem envio por e-mail que exponha dados).

## Guardrail

A geração da exportação NUNCA usa a service-role key (que ignora RLS). Deve rodar no
contexto autenticado do usuário, garantindo que ninguém exporte dado alheio.
