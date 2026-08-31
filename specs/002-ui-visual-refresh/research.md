# Research: Refinamento Visual da Interface

## Decisão: evoluir tokens semânticos sem mudar o contrato de preferência

- **Decision**: Manter as três opções e suas chaves persistidas (`preto`, `rosa`, `verde`), preservando os tokens-base de destaque; introduzir aliases de apoio para superfícies sutis, bordas, lavagens e estados de interação e aplicá-los de forma consistente.
- **Rationale**: A preferência é validada e persistida como dado de perfil e aplicada pelo layout protegido no HTML servido. Centralizar a evolução nos tokens melhora a coerência de todas as telas sem mudar schema, Server Action, SSR, labels ou comportamento do seletor.
- **Alternatives considered**: Criar novas opções de cor foi rejeitado por alterar o contrato de personalização. Ajustar cada módulo isoladamente foi rejeitado por repetir valores e produzir deriva visual.

## Decisão: separar neutros, destaque e estados semânticos por papel

- **Decision**: Definir uma escala neutra para canvas, superfície elevada/sutil, bordas e texto primário/secundário; reservar o destaque para identidade, seleção, links, foco e ações primárias; manter erro, sucesso e aviso semanticamente independentes.
- **Rationale**: Isso aumenta escaneabilidade e permite que conteúdo financeiro seja a prioridade visual. Os contrastes das cores sólidas atuais contra branco superam AA para texto normal, mas composições suaves, transparências e gradientes precisam de validação por tela e por preferência.
- **Alternatives considered**: Aplicar a cor escolhida em superfícies globais foi rejeitado porque aumenta ruído visual. Comunicar estados só por cor foi rejeitado porque enfraquece acessibilidade.

## Decisão: preservar redundância acessível de estados e interação

- **Decision**: Manter foco com outline perceptível, item ativo com marcador e fundo, inválido com borda/mensagem e estados com texto além de cor; preservar atributos, papéis e labels existentes.
- **Rationale**: Os padrões e testes atuais já cobrem teclado, associação de erro, diálogos e reflow. O refinamento deve reforçar, não substituir, esses sinais.
- **Alternatives considered**: Uma interface baseada em variação cromática ou animação como único indicador foi rejeitada por não cumprir a especificação nem a acessibilidade atual.

## Decisão: substituir hardcodes de marca por aliases onde forem identidade visual

- **Decision**: Trocar rosas e outras cores fixas usadas como marca em home, login, shell e componentes compartilhados por aliases de tokens quando fizerem parte da identidade; manter cores de categorias do gráfico isoladas como semântica financeira.
- **Rationale**: Hardcodes impedem que Verde, Rosa e Preto formem um conjunto harmonioso. As cores do gráfico devem continuar distintas para não alterar sua leitura categórica.
- **Alternatives considered**: Substituir indiscriminadamente toda cor fixa foi rejeitado porque pode mudar a semântica de categorias e estados.

## Decisão: entregar favicon institucional estático por convenções de metadata

- **Decision**: Criar um símbolo simples, sem texto e reconhecível em 16 px, com `app/icon.svg` como fonte escalável, `app/apple-icon.png` (180 × 180) para atalhos Apple e `app/favicon.ico` com tamanhos legados como fallback. Não criar manifest/PWA e não atrelar o ícone à cor de destaque individual.
- **Rationale**: Assets file-based do App Router se aplicam a páginas públicas e aninhadas sem alterar rotas ou metadados de cada tela. Um ícone institucional estável preserva reconhecimento e não depende de dados, cookies ou scripts.
- **Alternatives considered**: Somente ICO reduz escalabilidade; somente SVG reduz cobertura de atalhos; manifest/PWA amplia o contrato do produto além do escopo; favicon dinâmico pela preferência individual cria inconsistência e cache adicional.

## Decisão: validar regressão visual, funcional e responsiva com a suíte existente

- **Decision**: Usar lint, testes unitários, build e os testes E2E existentes de fundação visual, polimento, mobile e jornadas funcionais; complementar com revisão humana das composições translúcidas, das três preferências e do favicon em navegadores-alvo.
- **Rationale**: A suíte já prova persistência de cor inclusive sem JavaScript, teclado, foco, diálogos, reflow de 320 px e destinos de navegação. A percepção de harmonia e a legibilidade real do ícone requerem julgamento visual humano.
- **Alternatives considered**: Testes de snapshot como única evidência foram rejeitados, pois não provam completamente contraste, fluidez de fluxo e legibilidade em tamanhos reduzidos.

## Pesquisa: superfícies, exclusões e limitações

- **Superfícies revisadas**: `app/design-tokens.css`, layouts raiz/protegidos/login, CSS da home e shell, padrões de página e formulário, implementação de preferência de cor, metadata raiz, design de referência, `package.json` e testes E2E visuais/móveis.
- **Exclusões**: Nenhum arquivo de ambiente, segredo ou credencial foi lido; não foram executados servidor, build, browser ou testes; não houve alteração em código do produto.
- **Limitações e revisão humana necessária**: Aprovar o desenho final do símbolo (não existe logotipo versionado), confirmar contraste de camadas semitransparentes/gradientes em cada preferência e revisar o favicon em Chromium, Firefox e WebKit/iOS compatíveis.
