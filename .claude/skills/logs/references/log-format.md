# Catálogo de mensagens de log

Todas as mensagens de conversa passam por `logConversation`/`logConversationError`
(`src/mastra/helpers/logger.ts`), que prefixam com `[conversa <conversationId>] `. `logWarning` não
tem esse prefixo (é usado só pra erros sem conversa associada, ex.: payload inválido do Zendesk).

## `src/mastra/routes/zendesk-webhook.ts`

| Mensagem (template) | Quando acontece |
| --- | --- |
| `mensagem recebida de "<nome>" (<mediaType>, origem: <cliente\|empresa>)` | toda mensagem que chega do Zendesk — é aqui que se descobre o nome do cliente e o `conversationId` |
| `empresa mandou mensagem na conversa` | alguém do time respondeu pelo Zendesk (não é a Luna nem o cliente) |
| `luna desativada da conversa` | Luna foi desativada (bypass/bloqueio) pra essa conversa |
| `sticker recebido e ignorado` | mensagem tipo sticker, não processada |
| `transformando mensagem "<mediaType>"` | processando o conteúdo antes de mandar pra Luna |
| `Nova mensagem chegou, fluxo encerrado` | chegou mensagem nova enquanto já tinha um flush em andamento — o buffer antigo é abandonado |
| `Aguardando novas mensagens` | mensagem entrou no buffer, esperando a janela de debounce fechar |
| `Nenhuma nova mensagem, gerar resposta` | buffer fechou, vai perguntar pra Luna |
| `buffer fechado, perguntando pra Luna: "<texto mesclado>"` | texto final (mensagens do buffer mescladas) que vai pro agente |
| `Luna decidiu responder: "<resposta>"` | resposta gerada (caminho de erro/fallback específico — não é a linha padrão de resposta) |
| `resposta da Luna (guardrail: <ação>): "<texto>"` | resposta final pós-guardrail; `<ação>` é o resultado do `lunaGuardrail` (`reply`, `connect_human`, `reply_and_connect_human`, etc.) |
| `falha ao processar mensagem recebida` (error) | exceção no processamento do webhook |
| `falha ao processar buffer de mensagens` (error, em `message-buffer.ts`) | exceção ao dar flush no buffer |

`buildHandoffTags` só é chamado (e portanto só faz sentido procurar tag de handoff) quando a ação do
guardrail é `connect_human` ou `reply_and_connect_human`, ou nos caminhos de bypass/bloqueio
(`luna-interrompida`, sem tags de tabulação nesses casos — motivo fixo, sem chamar
`resolveTabulacaoTags`).

## `src/mastra/agents/tags/resolve-tabulacao-tags.ts`

Chamado em dois pontos: no handoff do Zendesk acima, e (só pra log/observabilidade, sem handoff) no
`/luna/ask` (`src/mastra/routes/luna-api.ts`) sempre que a requisição vem com `memory`.

| Mensagem (template) | Quando acontece |
| --- | --- |
| `histórico da conversa indisponível, sem tags de tabulação` | `Luna.getMessageHistory` falhou |
| `histórico vazio, sem tags de tabulação` | histórico existe mas está vazio |
| `resolvendo tags de tabulação (tipo_cliente: <tipo\|desconhecido>)` | início — dispara os 2 agentes de tag em paralelo |
| `tags de tabulação resolvidas: <lista separada por vírgula\|nenhuma>` | resultado final, já deduplicado (união do agente de operação + agente de tags especiais) |

`falha ao resolver tags de tabulação` (error, em `luna-api.ts`) — exceção nesse fluxo de background
do `/luna/ask` (não bloqueia a resposta ao usuário).

## Como as tags de handoff são montadas (`src/mastra/webhooks/zendesk/handoff-tags.ts`)

`buildHandoffTags(reason, workingMemory, tabulacaoTags)` monta um `Set` (sem duplicata) com:

1. `luna`, `luna-transferencia` — sempre, identificam a origem do handoff.
2. `reason` — motivo da transferência (ex.: `luna-interrompida`, ou a ação do guardrail).
3. `workingMemory.tipo_cliente` — se conhecido (`vendedor`, `comprador`, `improdutivo`,
   `parceiro_afiliado`, `imprensa`, `funcionario`).
4. `'evento_hoje'` — se `workingMemory.evento_hoje` for `true`.
5. Cada item de `tabulacaoTags` (o resultado do `resolveTabulacaoTags`, ver acima).

Ou seja: **nem toda tag do handoff vem do log de "tags de tabulação resolvidas"** — as 4 primeiras
categorias são fixas/derivadas da working memory, só a última vem dos 2 agentes de classificação.
Pra saber a lista completa que foi de fato pro Zendesk numa transferência, você precisa combinar o
motivo (ação do guardrail, na linha `resposta da Luna (guardrail: ...)`) + `tipo_cliente`/
`evento_hoje` (não aparecem sozinhos no log, inferir do contexto da conversa) + a linha `tags de
tabulação resolvidas`.

## Catálogo de tags de tabulação possíveis

Fonte única: `src/mastra/agents/tags/schema.ts` (`TABULACAO_TAGS_BY_CUSTOMER_TYPE`,
`CRITICAL_TAGS`). Ver `src/mastra/agents/tags/AGENTS.md` pra contexto completo dos 2 agentes (tags
de operação por `tipo_cliente` vs. tags especiais/críticas cross-cutting + tags "priority"
configuráveis no HiveOps). Não duplicar a lista aqui — ela muda com frequência; ler o `schema.ts`
direto quando precisar da lista atual.

## Outras mensagens (fora do fluxo de handoff)

- `src/mastra/agents/luna/luna.ts`: `Thread presa em referência de resposta expirada na OpenAI,
  reiniciando` (error) — recuperação automática de um erro específico da OpenAI.
- `src/mastra/agents/luna/processors/output-working-memory-processor.ts`: `falha ao atualizar
  working memory` (error).
- `logWarning`, sem prefixo de conversa: `evento zendesk inválido (app <id>)` — payload que não
  bateu com o schema esperado.

## Limitações

- O logger (`PinoLogger`) escreve só em stdout — não existe transporte persistente configurado, e
  o endpoint HTTP `/api/logs` do Mastra (`Authorization: Bearer $LUNA_API_KEY`,
  `?transportId=default`) retorna sempre vazio nesse projeto. A única fonte de histórico é o
  arquivo pra onde o stdout do processo foi redirecionado (ver `scripts/find-log.sh`) — se o
  processo não tiver sido iniciado com a saída redirecionada pra um arquivo, não tem como recuperar
  histórico de antes de agora.
- Existe também um domínio `observability` (spans/traces) gravado em DuckDB
  (`mastra.duckdb`, ver `src/mastra/mastra-instance.ts`), mas com o `mastra dev` rodando o arquivo
  fica travado pra outros processos — não tentar abrir com outra conexão enquanto o servidor
  estiver de pé.
