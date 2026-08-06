# Etapa 06 — Lançamento de despesas + Dashboard

**Status:** em andamento
**Aberto em:** 2026-08-05
**Plano aprovado em:** 2026-08-06
**Depende de:** Etapa 04 (schema), Etapa 05 (autenticação, sessão, workspace)

## Objetivo

Primeira tela de dado real do produto. Lançamento rápido de despesas/receitas
(fluxo simplificado já desenhado no Claude Design) e Dashboard consumindo esse
dado: saldo do mês, resumo por categoria, últimos lançamentos, gráfico
complementar ao saldo.

## Decisões fechadas (spec original)

1. **Formulário de lançamento:** Valor, Categoria, Data (auto-preenchida) visíveis
   por padrão; Descrição e Forma de pagamento atrás de "+ mais detalhes". Sem campo
   de Conta. "Quem lançou" vem da sessão, sem seleção manual.
2. **Categorias:** lista fixa (Alimentação, Aluguel, Assinaturas, Automóveis,
   Combustível, Condomínio, Internet, Lazer, Luz, Renda, Saúde), definida no
   código/banco. Sem tela de gerenciar categorias nesta etapa.
3. **Editar e excluir lançamento:** incluído no escopo desta etapa — não fica só
   criar/listar.
4. **Atualização do Dashboard após lançamento:** revalidação de página (via
   `revalidatePath` do Next.js), sem exigência de atualização em tempo real/otimista.
   Mais simples de implementar e testar, suficiente para o volume de uso de duas
   pessoas.
5. **Gráfico:** distribuição de gastos por categoria no mês (donut) ao lado do saldo
   total — não evolução temporal.

## Gaps identificados na spec e decisões técnicas propostas

Os pontos abaixo foram fechados antes de implementar, após conferir o schema, as
policies, a camada Supabase autenticada e os padrões das Etapas 04–05. Nenhuma das
decisões reintroduz Drizzle, `DATABASE_URL` ou service-role em runtime.

### 6. Biblioteca do gráfico e fronteira Server/Client

Três opções foram avaliadas:

| Opção | Vantagens | Trade-off |
| --- | --- | --- |
| `@visx/shape` | Modular, SVG, baixo nível e permite instalar só os primitives usados | Legenda, tooltip, cores e acessibilidade ficam sob responsabilidade da aplicação |
| Recharts | API declarativa pronta para `PieChart`, responsividade e recursos de acessibilidade | Superfície e bundle maiores do que o necessário para um único donut |
| Chart.js + `react-chartjs-2` | Doughnut e tooltip prontos, imports registráveis | Duas dependências, canvas menos semântico e integração essencialmente client-side |

Decisão: usar **`@visx/shape` v4**. O Dashboard permanece Server Component e faz
autenticação, leitura e agregação no servidor. Só `ExpenseDonut` será um Client
Component folha, para hover/touch e tooltip; receberá apenas o resumo serializável
por categoria, nunca lançamentos brutos, e não fará fetch. O gráfico será SVG com
`viewBox`, legenda textual e descrição acessível, sem adicionar pacote de medição
responsiva.

### 7. Exclusão de lançamento

Decisão: **hard-delete imediato**, com confirmação explícita de que a ação é
irreversível. Soft-delete foi descartado porque manteria dado financeiro oculto e
exigiria prazo documentado, comunicação ao usuário e purge automático; essa
complexidade não se justifica para um registro isolado no MVP e tensionaria o veto
de retenção indefinida em `.cadence/policies/data-handling.md`.

A exclusão usa o cliente Supabase autenticado e a policy `DELETE` existente. Qualquer
membro pode excluir, preservando a decisão da Etapa 04 de CRUD completo para membros
do workspace. Não haverá service-role, lixeira, auditoria com conteúdo financeiro ou
cópia residual do registro.

### 8. Formatação monetária e de data

Um módulo único, `lib/formatters.ts`, será compartilhado por Server e Client
Components:

- `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`;
- `Intl.DateTimeFormat("pt-BR", ...)` para exibição;
- datas `date` do Postgres tratadas como datas civis, sem deslocamento acidental de
  fuso;
- hoje e limites mensais calculados explicitamente em `America/Sao_Paulo`, sem
  depender do UTC do Vercel;
- valores somados como centavos inteiros, nunca com ponto flutuante;
- parser de entrada brasileira normalizando para `numeric(12,2)`, com valor positivo
  e dentro do limite da coluna.

### 9. Leitura do Dashboard

Decisão: Server Component usando `lib/supabase/server.ts`.

O fluxo confirma a sessão com `auth.getUser()`, resolve o workspace pela membership
visível via RLS, seleciona apenas as colunas necessárias de `transactions` e renderiza
saldo, resumo, lista e estados vazios no servidor. Não haverá fetch client-side,
Route Handler intermediário, conexão Drizzle, `DATABASE_URL` ou service-role. A
fronteira cliente recebe somente os dados de UI indispensáveis.

### 10. Cálculo de saldo e resumo por categoria

Decisão: agregação em JavaScript no servidor, em helper puro testado. Uma view ou RPC
seria mais eficiente em grande volume, mas criaria nova superfície de grants/RLS e o
risco de uma view executar com privilégios do owner se não fosse configurada como
`security_invoker`. Para o uso pessoal esperado, consultar somente o mês selecionado
e agregar linearmente é mais simples e suficiente. Um índice composto em
`(workspace_id, occurred_on, created_at)` sustentará a leitura mensal.

Semântica:

- saldo mensal = receitas − despesas − aportes;
- donut e resumo por categoria consideram apenas `expense`;
- categorias sem despesa no período não aparecem no donut;
- `contribution` permanece no schema, mas não é criado pelo formulário desta etapa.

**Decisão provisória:** tratar aportes como saída no saldo é uma aproximação até que
a Etapa de Metas defina a semântica real de aportes. Essa fórmula deve ser revisitada
explicitamente ao planejar Metas; não deve ser carregada adiante como decisão
permanente por inércia.

Se o volume real justificar no futuro, a agregação pode migrar para view/função
autenticada, somente com revisão de grants e novos testes de RLS.

### 11. Tipo do lançamento e categorias fixas

A spec não inclui campo visível de tipo, embora cubra despesas e receitas. Para não
reabrir o formulário fechado:

- categoria `Renda` deriva `kind = "income"`;
- todas as demais categorias derivam `kind = "expense"`;
- `contribution` fica fora da UI desta etapa;
- `kind`, `workspace_id` e `created_by` nunca são aceitos do navegador.

As categorias serão persistidas como códigos estáveis (`alimentacao`, `aluguel`,
`renda` etc.) e traduzidas para os rótulos em português por uma constante tipada
central.

**Limitação aceita conscientemente:** receitas de outra natureza, como reembolsos,
devem ser lançadas como `Renda`, usando a descrição opcional para detalhar a origem.
Não será adicionado campo de Tipo nesta etapa.

### 12. Forma de pagamento e integridade do schema

Adicionar `transactions.payment_method`, nullable, sem criar nova tabela. Valores
fixos: Pix, Cartão de crédito, Cartão de débito, Dinheiro, Boleto, Transferência e
Outro, persistidos como códigos estáveis.

A migration também deve:

- restringir `kind` aos valores previstos;
- exigir `amount > 0`;
- exigir categoria válida para despesas/receitas e garantir que `Renda` corresponda
  a `income`;
- restringir `payment_method` aos códigos fixos quando preenchido;
- limitar a descrição opcional a 200 caracteres;
- criar o índice da consulta mensal;
- fortalecer a policy de insert com `created_by = auth.uid()`;
- impedir alteração posterior de `workspace_id`, `created_by` e `created_at` por
  trigger de integridade;
- manter update/delete para qualquer membro, como fechado na Etapa 04.

Antes de aplicar constraints, a migration deve falhar se encontrar dados antigos
incompatíveis. Não corrige, reclassifica ou descarta dado financeiro silenciosamente.

### 13. Mês de referência e acesso à edição

O Dashboard abre no mês atual de São Paulo e aceita `?month=YYYY-MM`, validado
estritamente. Controles anterior/próximo permitem alcançar lançamentos antigos. A
lista mostra o mês selecionado, ordenada por `occurred_on` e `created_at`.

Criação permanece no Dashboard. Edição usa a rota protegida
`/transactions/[id]/edit`, com formulário reutilizado; exclusão fica disponível na
lista e na edição. Para retornar, só o mês validado é preservado — nunca um `returnTo`
arbitrário, evitando repetir o padrão de open redirect já encontrado na autenticação.

### 14. Server Actions e segurança

Server Actions finas para create/update/delete seguem o padrão da Etapa 05. Parsing,
validação, derivação de `kind` e agregação ficam em funções puras sob
`lib/transactions/`. Cada action confirma a sessão novamente, resolve workspace e
autoria no servidor e filtra update/delete por `id` + workspace além da RLS.

Registro inexistente e registro invisível por RLS retornam o mesmo erro genérico, sem
oráculo de existência. Nenhum erro ou log inclui descrição, categoria, valor, e-mail
ou corpo de formulário. Após sucesso, a action chama `revalidatePath("/dashboard")`;
não haverá realtime nem atualização otimista. O retorno ao Dashboard usa apenas o mês
validado.

### 15. Estados de interface

- Workspace sem lançamento: “Nenhum lançamento ainda. Registre sua primeira receita
  ou despesa para começar a acompanhar o mês.”
- Mês selecionado vazio: “Nenhum lançamento neste mês.”
- Receitas sem despesas: saldo permanece visível e o donut mostra “Sem despesas neste
  mês.”
- Falha de leitura/mutação: mensagem genérica, preservando os campos quando possível.
- Exclusão: “Excluir este lançamento? Esta ação não pode ser desfeita.”

Descrição e forma de pagamento ficam sob “+ mais detalhes”, usando `<details>` ou
componente semanticamente equivalente.

## Subtarefas

- [x] 1. Registrar o plano aprovado neste documento, antes de escrever código
- [x] 2. Testes unitários primeiro (TDD): categorias, parser monetário, data civil,
      validação, derivação de `kind`, saldo e agregação por categoria
- [x] 3. Testes de compliance primeiro: autoria forjada no insert, mutação de autoria/
      workspace, CRUD cruzado, constraints e hard-delete real
- [x] 4. E2E primeiro: estado vazio, criação de despesa/receita, detalhes opcionais,
      troca de mês, edição, confirmação/exclusão e revalidação dos totais
- [x] 5. `db/schema.ts` + migration de `payment_method`, constraints, índice, policy de
      autoria e campos imutáveis, com preflight sem alteração silenciosa de dados
- [x] 6. Constantes e tipos centrais de categoria, forma de pagamento e tipo
- [x] 7. Helpers centrais de moeda, data e período mensal
- [x] 8. Funções puras de validação, normalização e agregação em `lib/transactions/`
- [x] 9. Camada de acesso a lançamentos usando somente o cliente Supabase autenticado
- [ ] 10. Server Actions finas de criação, atualização e hard-delete, com
       `revalidatePath`
- [ ] 11. Dashboard Server Component: workspace, mês, saldo, resumo e lista
- [ ] 12. Formulário reutilizável, edição, detalhes recolhidos e confirmação de
       exclusão
- [ ] 13. `@visx/shape` + donut como Client Component folha, com legenda e alternativa
       acessível
- [ ] 14. Layout responsivo, estados vazios e falhas genéricas
- [ ] 15. Documentação do modelo e portabilidade incluindo `payment_method` e códigos
       persistidos
- [ ] 16. Validação final: migration no ambiente de teste, compliance, unitários, E2E,
       lint e build verdes

## Estratégia de commits

Conventional Commits em inglês, no imperativo, sem referência a IA. Cada commit cobre
um módulo ou arquivo lógico e inclui testes escritos antes ou junto da implementação
correspondente; nenhuma implementação precede sua cobertura TDD.

## Notas

- O repositório não contém o artefato do “Claude Design”. A implementação preserva o
  fluxo documentado nesta spec, mas não presume detalhes visuais ausentes.
- `README.md` e `.env.example` foram corrigidos antes da subtarefa 9: `DATABASE_URL`
  está documentada somente para o teste de conectividade, `DIRECT_URL` somente para
  schema/migrations e dados de usuário em runtime somente pelo Supabase JS autenticado.
- O idioma real dos commits é inglês. `CLAUDE.md` e `README.md` foram alinhados com
  essa convenção na aprovação deste plano.
- Subtarefa 2 confirmada em vermelho com
  `npx vitest run tests/unit/transactions`: cinco suítes falham somente porque os
  módulos `lib/transactions/*` ainda não existem, antes de qualquer implementação.
- Subtarefa 3 confirmada em vermelho contra o Supabase de teste com
  `npx vitest run tests/compliance/transaction-integrity.test.ts`: 18 casos, 4 já
  verdes pelas policies existentes e 14 falhando nas garantias deliberadamente ainda
  ausentes (autoria no insert, campos imutáveis, `payment_method` e constraints).
- Subtarefa 4 confirmada em vermelho contra aplicação e Supabase de teste com
  `npx playwright test tests/e2e/transactions-dashboard.spec.ts --workers=1`: quatro
  cenários falham na UI ainda ausente (formulário/estado vazio, criação e revalidação,
  resumo/donut/navegação mensal, edição e confirmação de hard-delete). O helper E2E
  repete uma vez somente `PGRST303` para neutralizar diferença transitória de relógio
  entre Auth e PostgREST em sessões recém-emitidas.
- Subtarefa 5 implementada em `0005_amusing_franklin_richards.sql`: preflight sem
  reclassificação automática, `payment_method`, constraints, índice mensal, autoria
  vinculada a `auth.uid()` no insert e trigger `SECURITY INVOKER` que torna
  `workspace_id`, `created_by` e `created_at` imutáveis. O primeiro ciclo do compliance
  encontrou a semântica de `CHECK` que aceita `NULL`; corrigida historicamente (sem
  reescrever migration já aplicada) por `0006_tan_scalphunter.sql`, exigindo que a
  relação `kind/category` seja explicitamente verdadeira. Migrations aplicadas no
  Supabase de teste e toda a pasta `tests/compliance` verde (27 testes em 4 arquivos).
- Subtarefa 6 implementada em `lib/transactions/categories.ts`, `kinds.ts` e
  `payment-methods.ts`, mantendo uma única fonte tipada para os mesmos códigos das
  constraints. Testes específicos verdes (16 casos em 3 arquivos), incluindo a
  derivação exclusiva de `income` para `renda`.
- Subtarefa 7 implementada em `lib/transactions/money.ts`, `civil-date.ts` e
  `lib/formatters.ts`: centavos inteiros sem arredondamento intermediário, entrada
  brasileira/ponto decimal HTML, calendário explícito de São Paulo, limites mensais
  exclusivos e `Intl` pt-BR centralizado. Testes específicos verdes (56 casos em 3
  arquivos).
- Subtarefa 8 implementada em `validate-transaction.ts` e
  `summarize-transactions.ts`: retorno discriminado sem ecoar input inválido, payload
  canônico para `numeric(12,2)`, `Renda` derivada como receita, soma segura em
  centavos e resumo de despesas ordenado por categoria. Testes específicos verdes
  (18 casos em 2 arquivos); aportes seguem a regra provisória da decisão 10.
- Subtarefa 9 implementada em `repository.ts` com cliente Supabase autenticado
  injetado: workspace resolvido pela membership visível, leitura mensal limitada por
  `workspace_id` e datas, mutações filtradas por `id` + workspace, payloads sem
  campos imutáveis e erros do Supabase reduzidos a código genérico. O hard-delete
  diferencia sucesso apenas internamente por booleano, sem revelar registro
  invisível. Testes escritos em vermelho antes do módulo e depois verdes (9 casos;
  toda a unidade de transações com 99 casos), TypeScript e lint verdes.
