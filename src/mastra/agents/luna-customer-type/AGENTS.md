# AGENTS.md — luna-customer-type

Leia este arquivo antes de alterar qualquer coisa nesta pasta.

## Objetivo

Classifica o contato numa conversa da Luna em uma de 6 categorias: vendedor, comprador, improdutivo, parceiro_afiliado, imprensa ou funcionario.

## Relação com outros agentes

- Chamado por `agents/luna/memory/conversation-memory-extractor.ts`, dentro do `onExtracted` do Extractor de memória observacional da Luna — não roda sozinho numa conversa normal.
- Recebe a transcrição da conversa já montada (`agents/luna/memory/transcript.ts`) e retorna só a `category`; quem grava o resultado (junto com `problem_summary`/`data_needed`/`data_collected`) é o extractor, na tabela `conversation_memory` do Supabase via HiveOps (`getHiveOps().upsertConversationMemory(...)`, ver `hiveops/AGENTS.md`).
- Também chamado por `agents/luna-working-memory/output-processor.ts` (`LunaWorkingMemoryProcessor`), em toda resposta da Luna, pra preencher o campo `tipo_cliente` da working memory — em paralelo com a decisão do `lunaWorkingMemoryAgent`. Dois chamadores independentes, mesmo classificador; nenhum sabe do outro.

## Arquivos desta pasta

- `luna-customer-type-agent.ts` — definição do `Agent` (`customerTypeAgent`), registrado em `src/mastra/index.ts`, mais o helper `classifyCustomerType(transcript)`. `defaultOptions.structuredOutput` já aponta pro `customerTypeOutputSchema`, então `.generate()` retorna `{ category }` em `result.object` sem precisar passar `structuredOutput` de novo.
- `prompts/system-prompt.ts` — prompt de classificação (`buildCustomerTypePrompt()`), no formato "classifique e só responda o json", igual ao padrão usado em `agents/luna-guardrail/`.
- `schema.ts` — schema zod das 6 categorias (`customerTypeCategories` + `customerTypeOutputSchema`).

## Notas de desenvolvimento

- Este agente é puramente uma classificação auxiliar da memória da Luna — não decide nada sobre o que a Luna responde ao cliente.
