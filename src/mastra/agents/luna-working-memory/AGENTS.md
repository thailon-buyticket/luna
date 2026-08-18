# AGENTS.md — luna-working-memory

Leia este arquivo antes de alterar qualquer coisa nesta pasta.

## Objetivo

Decide o que deve ser adicionado, atualizado ou removido na working memory da Luna — `id_pedido`, `nome_evento`, `nome_cliente`, `evento_hoje`, `motivo_contato` e `tipo_cliente` — a partir do par mais recente (mensagem do cliente, resposta da Luna). `id_pedido` e `nome_evento` são prioridade: o agente deve tentar descobri-los ativamente sempre que possível (inclusive olhando o que a Luna já respondeu, não só o que o cliente escreveu), em vez de só preencher quando o cliente repete o dado explicitamente.

## Relação com outros agentes

- Roda como `outputProcessor` de `agents/luna/`, em toda resposta gerada pela Luna — igual ao padrão de `agents/luna-guardrail/`.
- **A resposta da Luna espera esse processor terminar** (`await` dentro de `processOutputResult`, sem fire-and-forget) — isso adiciona latência real à resposta (mais duas chamadas de modelo: `lunaWorkingMemoryAgent` + `classifyCustomerType`), mas garante que `working_memory` em `/luna/reply` já reflita o que acabou de ser aprendido nesta mesma mensagem, não só nas anteriores. As duas chamadas rodam em paralelo entre si (`Promise.all`, ver abaixo) pra não somar as duas latências.
- Não depende da Luna chamar nenhuma tool. A Luna nem tem a tool `updateWorkingMemory` exposta (`workingMemory.agentManaged: false` em `agents/luna/luna-agent.ts`) — só enxerga a working memory como contexto somente leitura no próprio system prompt.
- **`tipo_cliente` não é decidido por este agente** — o `lunaWorkingMemoryAgent` só decide `id_pedido`/`nome_evento`/`nome_cliente`/`evento_hoje`/`motivo_contato` (`lunaWorkingMemoryUpdateSchema`, que omite `tipo_cliente`). Quem classifica isso é o `customerTypeAgent` (`agents/luna-customer-type/`, via `classifyCustomerType`), chamado em paralelo dentro de `output-processor.ts` com a transcript completa da conversa — o mesmo agente e padrão já usado por `agents/luna/memory/conversation-memory-extractor.ts` pro campo `customer_type` do Supabase. É recalculado a cada turno, sem debounce (mesma convenção do extractor).
- Não tem relação com a Observational Memory (`observationalMemory` em `agents/luna/luna-agent.ts`) nem com o extractor write-only de `agents/luna/memory/conversation-memory-extractor.ts` (que grava em `conversation_memory` no Supabase pra relatórios, não volta pro prompt). Working memory é uma camada separada, pensada especificamente para o que a própria Luna precisa lembrar durante o atendimento.

## Arquivos desta pasta

- `luna-working-memory-agent.ts` — definição do `Agent` de decisão, registrado em `src/mastra/index.ts`. `defaultOptions.structuredOutput` aponta pro `lunaWorkingMemoryUpdateSchema` (não o schema completo — ver acima).
- `schema.ts` — dois schemas:
  - `lunaWorkingMemorySchema`: shape completo (`id_pedido`, `nome_evento`, `nome_cliente`, `evento_hoje`, `motivo_contato`, `tipo_cliente`), usado pelo `workingMemory.schema` da `Memory` da Luna (`agents/luna/luna-memory.ts`) e por quem lê a working memory (ex: `routes/luna-api.ts`).
  - `lunaWorkingMemoryUpdateSchema`: o mesmo sem `tipo_cliente` (`.omit`), usado pelo `lunaWorkingMemoryAgent`.
  - Campos são `nullable` — `null` remove o valor (merge semantics do Mastra, ver `deepMergeWorkingMemory`). **Não usar `z.record(...)`/dicionário de chave livre aqui** — o OpenAI Structured Outputs (usado pelo `lunaWorkingMemoryAgent`, modelo `gpt-5-mini`) rejeita schemas com `propertyNames`/chaves abertas (`AI_APICallError: 'propertyNames' is not permitted`); qualquer campo "outros dados" livre precisa ser texto, não um mapa chave-valor.
- `prompts/system-prompt.ts` — instruções do agent de decisão.
- `output-processor.ts` — `Processor` (`processOutputResult`) que:
  1. Lê a working memory atual via `lunaMemory.getWorkingMemory(...)`.
  2. Chama, em paralelo (`Promise.all`): o `lunaWorkingMemoryAgent` (JSON atual + par mensagem/resposta) e `classifyCustomerType` (transcript completo via `messagesToTranscript(messageList.get.all.db())`, de `agents/luna/memory/transcript.ts`) pro `tipo_cliente`.
  3. Combina os dois resultados (`{ ...update, tipo_cliente }`), faz merge com `deepMergeWorkingMemory` (de `@mastra/memory`) e persiste com `lunaMemory.updateWorkingMemory(...)`.
  4. Tudo isso é `await`ado dentro de `processOutputResult` — erros são capturados e só logados (não derrubam a resposta da Luna), mas o tempo de execução conta pra latência total da resposta.

  **Por que `lunaMemory` importado diretamente (não `agent.getMemory()`):** o campo `agent` de `ProcessOutputResultArgs` não vem populado quando a Luna é chamada via `routes/luna-api.ts` (`luna.generate(...)` direto) — só nesse call path, `agent` chega `undefined` no processor, então `agent.getMemory()` nunca resolvia nada e o processor saía silenciosamente sem atualizar nada (bug real encontrado e corrigido). A `Memory` da Luna foi extraída pra `agents/luna/luna-memory.ts` (não fica mais inline em `luna-agent.ts`) especificamente pra esse processor poder importá-la direto, sem depender do `agent` do contexto do processor **e sem criar import circular** com `luna-agent.ts` (que importa este `output-processor.ts` pros seus `outputProcessors`).

## Notas de desenvolvimento

- `scope: 'resource'` na working memory da Luna (não `'thread'`) — os dados persistem entre conversas diferentes do mesmo cliente, coerente com o uso já documentado de `memory.resource` no README (`/luna/reply`).
- Se no futuro for preciso que a Luna decida sozinha atualizar a working memory (ex: durante a própria geração da resposta), seria necessário setar `workingMemory.agentManaged: true` em `agents/luna/luna-memory.ts` — hoje isso é intencionalmente `false`.
- Se precisar adicionar mais um "dono" pra `lunaMemory` fora de `agents/luna/`, importe de `agents/luna/luna-memory.ts`, nunca de `agents/luna/luna-agent.ts` (evita reintroduzir o ciclo).
