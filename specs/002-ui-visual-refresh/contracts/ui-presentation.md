# Contrato de Apresentação da UI

## Propósito

Este contrato define o que deve permanecer observável para pessoas usuárias enquanto a apresentação visual do Cadence é refinada. Ele não cria uma API pública nem altera contratos de dados.

## Compatibilidade funcional

| Área | Contrato observável |
|------|----------------------|
| Rotas e navegação | Os mesmos destinos, nomes, estados ativos e ações continuam disponíveis. |
| Formulários e diálogos | Os mesmos controles, labels, validações, mensagens e resultados permanecem utilizáveis por mouse, toque e teclado. |
| Personalização | Preto, Rosa e Verde continuam selecionáveis, persistidos por pessoa e aplicados sem exigir JavaScript. |
| Estados | Foco, seleção, erro, sucesso, aviso, carregamento, vazio e indisponibilidade continuam distinguíveis por sinais além da cor. |
| Responsividade | Ações e informação permanecem acessíveis, sem bloqueio por sobreposição ou overflow, nas larguras hoje cobertas pela suíte. |
| Dados e privacidade | Nenhuma coleta, cookie, analytics, request de dados ou mudança de acesso é introduzida para o refinamento visual. |

## Contrato do favicon

- Um ícone institucional estático do Cadence é publicado na raiz da aplicação por convenções de metadata.
- O símbolo não contém texto minúsculo, dados de usuário, valores financeiros, dados de localização, rastreamento ou comportamento personalizado.
- O ícone é legível em tamanhos de aba e tem variantes/fallbacks compatíveis para atalhos Apple e clientes legados.
- A ausência de suporte a um formato de ícone não afeta navegação, autenticação ou operações do produto.

## Critérios de aceitação de apresentação

- Hierarquia de ações e conteúdo é perceptível sem depender apenas da cor.
- O uso da cor de destaque não conflita com os significados de erro, sucesso e aviso.
- As composições de texto, controle, foco e borda mantêm contraste suficiente para leitura e interação em cada preferência.
