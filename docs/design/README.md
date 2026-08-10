# Referência de design — Cadence

`prototype.html` é o export bruto do protótipo produzido no Claude Design (uso:
abrir no navegador para inspeção visual). Como é um arquivo bundled (HTML/CSS/JS
compactados), não é diretamente legível como texto — este README resume o que
importa para quem for implementar a UI.

## Áreas e navegação

A navegação principal tem 3 rotas: Dashboard · Fixas · Metas.

Lançamentos é uma seção do Dashboard (criação e listagem), não uma quarta rota.

## Vocabulário de produto (nomenclatura oficial das telas)

- **Lançamento:** Categoria, Conta*, Data, Descrição, Valor, "Registrar lançamento"
  (*campo de Conta removido nas decisões da Etapa 06 — ver `docs/planning/`)
- **Contas fixas:** Nome da conta, Dia do vencimento, Vencimento em dia fixo todo
  mês, Débito automático, Valor variável (média), "Nova conta fixa", "Confirmar
  pagamento", Data do pagamento, Forma de pagamento
- **Metas:** Objetivo, Aporte mensal → evoluiu para "ritmo sugerido" (ver Etapa
  07), Meta conjunta, "Criar meta", "Salvar meta"

## Categorias de referência

Alimentação, Aluguel, Assinaturas, Automóveis, Combustível, Condomínio, Internet,
Lazer, Luz, Renda, Saúde, (Teatro/Mercado — exemplos de descrição, não categorias)

## Identidade visual

- Estilo: minimalista/clean, cor de destaque customizável (opções observadas no
  protótipo: Preto, Rosa, Verde)
- Tom de linguagem: casual porém formal (revisado na fase de polimento — ver
  histórico de decisões)

## Nota importante

Este documento reflete o protótipo **visual** aprovado no Claude Design. As
decisões de **produto e schema** registradas em `docs/planning/etapa-XX-*.md`
têm precedência quando houver conflito (ex: campo "Conta" existe no protótipo
visual mas foi removido na implementação real da Etapa 06). Em caso de dúvida,
specs de implementação > protótipo visual.
