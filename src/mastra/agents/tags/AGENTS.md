# AGENTS.md — tags

Leia este arquivo antes de alterar qualquer coisa nesta pasta.

## Objetivo

Escolhe a tag de tabulação de um atendimento (ex.: `ajuda_com_venda`, `nao_recebi_o_ingresso`) a
partir do `tipo_cliente` e da transcript da conversa, pra mandar pro Zendesk junto com o handoff
pra humano. Só existe regra própria pra vendedor e comprador — pros demais tipos (improdutivo,
parceiro_afiliado, imprensa, funcionario), usa o merge das duas listas (decisão explícita do
usuário: "se não for comprador nem vendedor, pode ser o merge dos dois casos").

## Relação com outros agentes

- Chamado por `routes/zendesk-webhook.ts` (`resolveTabulacaoTag`), só quando o guardrail decide
  `connect_human`/`reply_and_connect_human` e existe `working_memory.tipo_cliente` (vindo de
  `agents/luna-working-memory/`) — pra qualquer uma das 6 categorias.
- A tag escolhida entra na lista final de tags do handoff junto com `luna`, `luna-transferencia`, o
  motivo da transferência, o próprio `tipo_cliente` e `evento_hoje` (quando true) — ver
  `webhooks/zendesk/handoff-tags.ts` (`buildHandoffTags`) e `webhooks/zendesk/zendesk.ts`
  (`connectHuman`, que serializa tudo em `dataCapture.systemField.tags` no `passControl`).
- Não decide nada sobre a resposta da Luna nem sobre o guardrail — roda só depois que a decisão de
  transferir já foi tomada.

## Arquivos desta pasta

- `schema.ts` — `vendedorTabulacaoTags`/`compradorTabulacaoTags` (as listas de tags válidas por
  tipo de cliente, vindas literalmente do que o time de suporte passou) e `tabulacaoOutputSchema`
  (schema zod usado no `structuredOutput` do agent).
- `prompts/system-prompt.ts` — `buildSystemPrompt(customerType, dates)` monta a instrução com a
  lista de tags certa pro tipo de cliente (vendedor, comprador, ou o merge das duas pros demais
  tipos) e a regra especial de `cadastro_de_eventos_hoje` / `_essa_semana` / `cadastro_de_eventos`
  (baseada em datas).
- `tags-agent.ts` — `tagsAgent` (registrado em `mastra-instance.ts`), `buildDateThresholds` (calcula
  hoje/+2/+3/+5 dias em código — nunca deixar o modelo fazer essa conta) e o helper
  `classifyHandoffTag(transcript, customerType)`, que monta o prompt certo por chamada e chama
  `tagsAgent.generate(transcript, { instructions })`.

## Notas de desenvolvimento

- As instruções do `tagsAgent` são dinâmicas por chamada (dependem de `tipo_cliente` e da data de
  hoje) — por isso o agent é criado com uma instrução placeholder e cada chamada passa
  `instructions` via `generate()`, em vez de um prompt fixo no construtor (padrão diferente dos
  outros agents desta pasta `agents/`, que têm prompt estático).
- `dataCapture.ticketField.<id>` de id_pedido e conversation_id já estão em
  `webhooks/zendesk/ticket-fields.ts` (`buildHandoffTicketFields`). Ainda falta o de
  `motivo_contato` (e outros que o time de suporte mandar) — quando o ID do campo chegar, adicionar
  lá, não aqui.
- Se aparecer uma regra própria pra algum dos tipos que hoje caem no merge (improdutivo,
  parceiro_afiliado, imprensa, funcionario), adicione a lista em `schema.ts` e um branch dedicado
  em `buildSystemPrompt` (`prompts/system-prompt.ts`), do mesmo jeito que vendedor/comprador.
