# Etapa 09 — Fundação visual (navegação + tokens + cor de destaque)

**Status:** em andamento
**Aberto em:** 10/08/2026
**Plano aprovado em:** 10/08/2026
**Depende de:** Etapas 05–08 (todas as telas existentes: dashboard, lançamentos,
metas, contas fixas)

## Objetivo

Consolidar a base visual compartilhada entre as 3 rotas funcionais do app, hoje
construídas isoladamente (CSS Modules por página, sem sistema de tokens comum):
navegação persistente, variáveis de design centralizadas e a cor de destaque
customizável — decisão de design original nunca implementada. Lançamentos permanece
como seção do Dashboard, sem rota própria.

## Decisões fechadas

1. **Cor de destaque é preferência por pessoa**, não por workspace. Bruno e
   Alyne podem escolher cores diferentes mesmo usando o mesmo workspace.
2. **Três opções fixas**, herdadas do protótipo: Preto, Rosa, Verde. Sem
   expansão nesta etapa.
3. **Armazenamento:** nova coluna `accent_color` em `profiles`, sujeita à mesma
   policy já existente (`id = auth.uid()`) — sem coluna imutável nem trigger nova,
   pois é preferência editável a qualquer momento.
4. **Navegação persistente** entre Dashboard, Metas e Contas fixas, mais logout.
   Lançamentos continua como seção do Dashboard; não haverá rota `/transactions`.
5. **Tokens de design centralizados** (cor, tipografia, espaçamento) em vez de
   duplicados por CSS Module — fundação para a Etapa 10 consumir depois.

## Gaps identificados na spec e decisões técnicas propostas

Os pontos abaixo foram aprovados antes da implementação, após conferir o layout
protegido, o schema e as policies de `profiles`, os nove CSS Modules existentes e os
padrões das Etapas 04–08. Nenhuma decisão adiciona dependência, service-role em
runtime ou acesso a dado financeiro no cliente.

### 6. Local do shell autenticado

Manter `app/(protected)/layout.tsx` como fronteira de autenticação e tema. Criar um
layout aninhado apenas para as rotas que dependem de workspace:

```text
app/(protected)/
├── layout.tsx                    # autenticação + preferência server-side
├── layout.module.css             # escopo do tema autenticado
├── onboarding/                   # permanece sem navegação do app
└── (workspace)/
    ├── layout.tsx                # shell e navegação persistente
    ├── dashboard/
    ├── goals/
    ├── fixed-bills/
    ├── transactions/
    ├── contributions/
    └── bill-payments/
```

O route group `(workspace)` não altera URLs. Ele evita mostrar a navegação das áreas
financeiras durante o onboarding e mantém o shell nas telas de edição.

Componentes compartilhados ficam em:

```text
components/app-shell/
├── app-navigation.tsx
├── accent-color-form.tsx
└── app-shell.module.css
```

`app-navigation.tsx` será um Client Component folha apenas para ler `usePathname`;
não fará fetch nem receberá dado financeiro.

### 7. Três destinos e estado ativo

A navegação terá exatamente três destinos persistentes:

- `/dashboard` — inclui criação e listagem de lançamentos;
- `/goals`;
- `/fixed-bills`;
- logout como ação separada, não como área.

Não haverá `/transactions` nem link por âncora para simular uma quarta rota. O
estado ativo seguirá também as telas de edição:

- `/dashboard` e `/transactions/*` → Dashboard;
- `/goals/*` e `/contributions/*` → Metas;
- `/fixed-bills/*` e `/bill-payments/*` → Fixas.

`docs/design/README.md` será corrigido junto do registro deste plano: a lista antiga
de quatro telas era documentação desatualizada, não uma decisão nova.

### 8. Domínio da cor em `profiles`

Adicionar `accent_color text not null default 'verde'` com `CHECK` restrito a
`('preto', 'rosa', 'verde')` em `db/schema.ts` e na migration correspondente.

`verde` é o default porque o app atual já usa verde como destaque e o protótipo
também inicia nessa opção, minimizando mudança involuntária para usuários existentes.
O `DEFAULT` preenche linhas existentes e atende inserts futuros de
`handle_new_user()` sem alterar a função.

Não haverá policy, trigger de imutabilidade ou grant novo. `profiles` é a exceção
pessoal já documentada na Etapa 04: a tabela não tem `workspace_id` e sua RLS isola
por `id = auth.uid()`. A aplicação reforça essa policy com filtro explícito no mesmo
`id`; o padrão `id + workspace_id` das entidades financeiras não se aplica a uma
preferência deliberadamente por pessoa.

### 9. Leitura e atualização da preferência

Criar:

```text
lib/profiles/
├── accent-colors.ts              # domínio, labels e validação pura
└── repository.ts                 # leitura/update pelo cliente autenticado

lib/actions/profile.ts            # Server Action fina
```

A atualização aceita somente o código da cor, deriva o usuário de
`auth.getUser()`, filtra por `id = user.id` além da RLS e nunca aceita um id de
perfil do formulário. Linha inexistente, invisível ou falha de query produzem o
mesmo erro genérico para o usuário. A action revalida o layout após sucesso e não
loga preferência, UUID, e-mail ou corpo do formulário.

### 10. Aplicação sem FOUC e fallback observável

O layout protegido consulta `profiles.accent_color` antes de renderizar e emite no
HTML inicial um atributo como `data-accent="verde"`. `app/design-tokens.css` mapeia
esse atributo para as variáveis CSS antes do primeiro paint. Não haverá `useEffect`,
`localStorage` ou script client-side trocando a cor depois da hidratação.

Em falha de leitura ou linha legada ausente, o layout usa `verde` como fallback para
preservar disponibilidade, mas a ocorrência **é registrada no log do servidor**. O
evento contém somente contexto estável e não pessoal — `query_failed` ou
`profile_missing` — sem UUID, e-mail, preferência, mensagem bruta do Supabase ou
corpo de request. O fallback não é exibido como erro ao usuário, mas também não
silencia drift de schema, trigger ou indisponibilidade do banco.

Paletas herdadas do protótipo:

| Código  | Destaque | Suave     | Forte     |
| ------- | -------- | --------- | --------- |
| `verde` | `#14624a` | `#e8f1ed` | `#0c3f2f` |
| `rosa`  | `#c2386f` | `#fdeef3` | `#87234a` |
| `preto` | `#201e1d` | `#f0efef` | `#0a0909` |

### 11. Tokens centralizados e alcance da refatoração

Criar `app/design-tokens.css`, importado pelo layout raiz antes de `globals.css`,
como fonte única de:

- cores neutras e de estado;
- trio de destaque por pessoa, cor de foco e fundo tonal;
- escala tipográfica;
- escala de espaçamento;
- raios, sombras, largura de conteúdo e altura mínima de controles.

Os CSS Modules continuam responsáveis por grids, composição e breakpoints de cada
tela. Os nove módulos atuais somam aproximadamente 1.171 linhas e já consomem parte
das variáveis globais; portanto, a migração será direcionada, não uma reescrita:

- substituir verdes literais dos anéis de foco;
- consolidar superfícies, bordas, botões, campos, tipografia e espaçamentos repetidos;
- remover navegações locais duplicadas das três páginas;
- preservar regras específicas do Dashboard, donut, metas e contas fixas.

Não será introduzida biblioteca de componentes, Tailwind ou CSS-in-JS. Microcopy,
estados e composição fina permanecem para a Etapa 10.

### 12. Navegação responsiva e acessível

Seguir a estrutura do protótipo: navegação lateral persistente no desktop e
cabeçalho compacto com navegação inferior persistente no mobile. A troca será feita
com media queries, sem medição de viewport em JavaScript.

Links usam `aria-current="page"`; logout fica semanticamente separado; controles
têm alvo mínimo de 44 px e foco visível. O seletor de cor usa `fieldset`, legenda e
os rótulos Preto, Rosa e Verde, sem comunicar estado apenas pela amostra visual.

A preferência não será aplicada de forma otimista no cliente: a cor muda após a
persistência e o novo render do servidor, mantendo uma única fonte de verdade.

### 13. Compliance e documentação

A cor é uma preferência pessoal vinculada a uma pessoa identificável, mas não é
dado financeiro nem sensível. É coletada somente para personalização funcional.

Atualizar:

- `.cadence/policies/data-handling.md` — preferência funcional na lista mínima;
- `docs/specs/data-model-and-deletion.md` — coluna, domínio, RLS e apagamento junto
  do perfil;
- `docs/specs/data-portability.md` — preferência no contrato de exportação do
  perfil;
- `docs/compliance/lgpd-mapping.md` — finalidade de personalização da interface sob
  execução do serviço/contrato, mantendo a marca de revisão jurídica.

Não existe achado ou exceção de segurança conhecido nesta mudança. A expectativa é
não editar `security-findings-log.md` nem `security-exceptions.md`; a conclusão da
revisão será registrada nas notas desta etapa.

### 14. Cobertura de testes

Testes antes ou junto de cada implementação:

- unitários: domínio e validação das três cores, repositório, Server Action,
  fallback observável e mapeamento de rotas para estado ativo;
- compliance: default, leitura/update próprios, bloqueio cruzado, `CHECK` e cascata
  do perfil;
- E2E: shell nas três rotas e edições, troca/persistência da cor, independência por
  pessoa, HTML correto sem JavaScript, logout e viewport móvel sem overflow.

## Subtarefas

- [x] 1. Registrar o plano aprovado neste documento, corrigir a Etapa 08 para
      `concluído` no índice e corrigir `docs/design/README.md` para três rotas com
      Lançamentos como seção do Dashboard, antes de escrever código
- [x] 2. Testes unitários primeiro (TDD): domínio/validação da cor, repositório,
      Server Action, fallback observável e mapeamento de rotas para estado ativo
- [x] 3. Testes de compliance primeiro: default, `CHECK`, leitura/update próprios,
      isolamento cruzado e cascata do perfil
- [x] 4. E2E primeiro: shell persistente, estado ativo, logout, troca/persistência
      por pessoa, render sem JavaScript e viewport móvel
- [x] 5. `db/schema.ts` + migration de `profiles.accent_color`, default e `CHECK`,
      sem policy, grant ou trigger nova
- [x] 6. Domínio, repositório Supabase autenticado e Server Action fina da
      preferência
- [x] 7. `app/design-tokens.css` com paletas, tipografia, espaçamento e tokens
      semânticos
- [x] 8. Aplicar a preferência no render server-side do layout protegido, com
      fallback verde e log sanitizado
- [x] 9. Criar o route group `(workspace)` e mover as rotas sem alterar URLs
- [x] 10. Implementar shell e navegação responsiva, incluindo logout e seletor de
       cor
- [x] 11. Remover navegações locais duplicadas e migrar os CSS Modules para os
       tokens compartilhados
- [x] 12. Validar acessibilidade, estado ativo, foco, contraste, mobile e ausência
       de FOUC
- [x] 13. Atualizar modelo, portabilidade, política de dados e mapeamento LGPD
- [ ] 14. Validação final: migration no ambiente de teste, compliance, unitários,
       E2E sem skips, lint, TypeScript, build e sincronização Drizzle verdes

## Estratégia de commits

Conventional Commits em inglês, no imperativo e sem referência a IA. Cada commit
cobre um módulo ou arquivo lógico e inclui testes escritos antes ou junto da
implementação correspondente; nenhuma implementação precede sua cobertura TDD.

## Notas

- O índice ainda marcava a Etapa 08 como `em andamento`, apesar de seu documento e
  commit de conclusão já registrarem `concluído`; corrigido junto da aprovação deste
  plano.
- A referência de design ainda listava Lançamentos como uma quarta tela. O código e
  as decisões de implementação sempre o mantiveram dentro do Dashboard; a referência
  foi alinhada junto deste plano, sem ampliar ou reduzir funcionalidade.
- Subtarefa 2 confirmada em vermelho com
  `npx vitest run tests/unit/profiles tests/unit/navigation`: cinco suítes falham
  somente porque `lib/profiles/accent-colors.ts`, `repository.ts`,
  `resolve-accent-color.ts`, `lib/actions/profile.ts` e
  `lib/navigation/routes.ts` ainda não existem. Os 38 casos fixam o domínio das três
  cores e o default verde, filtro de perfil por id além da RLS, payload editável
  mínimo, erro genérico, fallback com log sanitizado e o estado ativo das três rotas
  e suas telas de edição antes da implementação. O lint dos novos testes está verde.
- Subtarefa 3 confirmada em vermelho contra o Supabase de teste com
  `npx vitest run tests/compliance/profile-preference.test.ts`: os cinco casos
  falham exclusivamente porque `profiles.accent_color` ainda não existe. A cobertura
  fixa default verde, preferências independentes, leitura/update próprios, bloqueio
  cruzado por RLS, domínio fechado e remoção junto do perfil antes da migration.
- Subtarefa 4 confirmada em vermelho com
  `npx playwright test tests/e2e/visual-foundation.spec.ts --workers=1`: os três
  cenários falham no shell e seletor ainda ausentes. A cobertura fixa exatamente três
  links, estado ativo nas rotas principais e edições, logout, persistência por pessoa,
  preferência presente no HTML com JavaScript desabilitado e viewport móvel sem
  overflow. O lint dos novos testes de compliance e E2E está verde.
- Subtarefa 5 implementada em `0010_old_random.sql`: `accent_color` é `text not
  null default 'verde'` e o `CHECK` aceita somente `preto`, `rosa` e `verde`. A
  migration não altera policy, grant ou trigger; `handle_new_user()` herda o default.
  Após aplicação no Supabase de teste, os cinco casos de compliance ficaram verdes.
- Subtarefa 6 implementou o domínio tipado, repositório autenticado limitado por
  `id`, Server Action fina, fallback server-side e mapa puro da navegação. Erros do
  Supabase são reduzidos a `query_failed`; o logger de fallback recebe somente
  `profile_missing` ou `query_failed`. A primeira execução ativou os 38 casos e
  encontrou uma asserção inválida do próprio teste para string vazia; corrigida sem
  alterar o contrato. As cinco suítes ficaram verdes, assim como lint e TypeScript.
- Subtarefas 7–11 implementaram `design-tokens.css`, tema autenticado emitido no
  HTML pelo Server Component, shell compartilhado e route group `(workspace)` sem
  alterar URLs. Desktop usa sidebar; mobile usa cabeçalho compacto e navegação
  inferior. As páginas perderam seus menus locais, e os CSS Modules passaram a
  consumir tokens de foco, controle, raio, tipografia e espaçamento sem reescrever
  seus grids específicos. Onboarding permanece fora do shell.
- Subtarefa 12 validou as três paletas: contraste de texto branco sobre destaque é
  7,30:1 no verde, 5,14:1 no rosa e 16,60:1 no preto; texto forte sobre os fundos
  suaves fica acima de 7,8:1. O E2E focal passou 3/3 em 22,3 s, cobrindo estado ativo,
  logout, preferência independente, HTML inicial sem JavaScript e viewport de 390 px
  sem overflow. A primeira execução expôs o botão de Dev Tools do Next cobrindo o
  último controle da sidebar no ambiente dev; o shell passou a reservar área segura
  inferior, e o teste voltou a usar clique real sem `force`.
- Subtarefa 13 atualizou a política de tratamento, modelo de dados, portabilidade e
  mapeamento LGPD. A preferência é um código funcional mínimo do perfil, exportável
  somente pela própria pessoa e removido junto da conta. `security-findings-log.md`
  e `security-exceptions.md` foram revisados e não exigem alteração: não houve achado
  corrigido, risco aceito nem nova retenção.
