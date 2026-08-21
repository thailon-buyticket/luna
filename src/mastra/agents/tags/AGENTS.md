# AGENTS.md — tags

Leia este arquivo antes de alterar qualquer coisa nesta pasta.

## Objetivo

Analisa TODO o histórico de um atendimento e retorna TODAS as tags com evidência clara — zero, uma
ou várias, nunca "a melhor" — pra mandar pro Zendesk junto com o handoff pra humano. São **2
agentes** (era um fluxo antigo de 3 agents em n8n, reduzido a 2), que rodam em paralelo e cujos
resultados são unidos (`resolveTabulacaoTags` em `routes/zendesk-webhook.ts`):

1. **Tags de operação** (`tags-agent.ts`) — tags de tabulação (ex.: `ajuda_com_venda`,
   `nao_recebi_o_ingresso`) a partir do `tipo_cliente` e da transcript. Só existe lista própria pra
   vendedor e comprador — pros demais tipos (improdutivo, parceiro_afiliado, imprensa,
   funcionario), usa o merge das duas listas (decisão explícita do usuário: "se não for comprador
   nem vendedor, pode ser o merge dos dois casos"). Precisa saber o `tipo_cliente`.
2. **Tags especiais/críticas** (`special-tags-agent.ts`) — reavalia `evento_hoje` e as variantes de
   cadastro de evento (`cadastro_de_eventos[_hoje|_essa_semana]`) MAIS as tags "priority"
   configuradas pelo time de suporte no HiveOps, cross-cutting: não depende do `tipo_cliente`. A
   duplicata com o agente de operação (que também cobre essas 4 tags) é inofensiva — o `Set` em
   `buildHandoffTags` deduplica o resultado final.

## Relação com outros agentes

- Chamados por `routes/zendesk-webhook.ts` (`resolveTabulacaoTags`), só quando o guardrail decide
  `connect_human`/`reply_and_connect_human`. Tags de operação só entram se
  `working_memory.tipo_cliente` (vindo de `agents/luna-working-memory/`) já for conhecido; tags
  especiais sempre rodam (não dependem do tipo).
- Tags de operação reaproveitam a descrição do `tipo_cliente` de
  `agents/luna-customer-type/category-descriptions.ts` (`customerTypeCategoryDescriptions[tipo]`)
  pra dar contexto ao modelo sobre quem é esse cliente — fonte única, não duplicar esse texto aqui.
- Tags especiais chamam `getHiveOps().getPriorityTags()` (`hiveops/`) pra buscar as tags "priority"
  configuráveis pelo time de suporte (tabela `tags`, `type: 'priority'`, mesma tabela de
  `getHandoffTagTitles()`).
- O resultado dos 2 agentes entra na lista final de tags do handoff junto com `luna`,
  `luna-transferencia`, o motivo da transferência, o próprio `tipo_cliente` e `evento_hoje` (quando
  true na working memory) — ver `webhooks/zendesk/handoff-tags.ts` (`buildHandoffTags`, que aceita
  um array de `string`) e `webhooks/zendesk/zendesk.ts` (`connectHuman`, que serializa tudo em
  `dataCapture.systemField.tags` no `passControl`).
- Não decidem nada sobre a resposta da Luna nem sobre o guardrail — rodam só depois que a decisão de
  transferir já foi tomada.

## Arquivos desta pasta

- `schema.ts`:
  - `TABULACAO_TAGS_BY_CUSTOMER_TYPE` é a FONTE ÚNICA das tags de operação: um dicionário
    `{ vendedor: [...], comprador: [...] }` com as listas válidas por tipo de cliente, vindas
    literalmente do que o time de suporte passou. Pra adicionar/remover/renomear uma tag, mexa só
    aqui — tanto o prompt (`prompts/system-prompt.ts`) quanto o enum do structured output
    (`buildTabulacaoOutputSchema`) leem deste dicionário.
  - `CRITICAL_TAGS` — as 4 tags críticas fixas do agente de tags especiais (`evento_hoje` +
    variantes de `cadastro_de_eventos`), tipadas como `TabulacaoTag` (subconjunto do dicionário
    acima, então nunca saem de sincronia com ele).
  - `tabulacaoOutputSchema` / `buildTabulacaoOutputSchema(customerType)` — schema placeholder e
    schema de verdade (`{ tags: TabulacaoTag[] }`) do agente de operação, enum travado na lista
    certa do tipo de cliente (ver nota abaixo).
  - `buildSpecialTagsOutputSchema(hiveOpsPriorityTagTitles)` — schema do agente de tags especiais,
    enum = `CRITICAL_TAGS` + os títulos "priority" do HiveOps daquela chamada.
- `prompts/system-prompt.ts`:
  - `SPECIAL_TAG_RULES` + `buildSpecialRules(tags)` — regras especiais (uma entrada por tag ou par
    vendedor/comprador equivalente, ex.: `cancelar_venda`/`cancelar_compra`), cada uma com
    `appliesTo` (quais tags a ativam) e o texto da regra. `buildSpecialRules` filtra e injeta só as
    regras cujas tags existem na lista da vez — usado pelos dois agentes (`buildSystemPrompt` e
    `buildSpecialTagsSystemPrompt`), então uma regra especial nova é só uma entrada aqui.
  - `buildEventDateRule(dates)` — texto da regra de 48h que decide entre `cadastro_de_eventos_hoje`
    / `_essa_semana` / `cadastro_de_eventos`; compartilhado pelo bloco de vendedor
    (`buildAvailableTagsBlock`) e pelo agente de tags especiais, já que as 3 variantes são tags
    críticas nos dois.
  - `buildSystemPrompt(customerType, dates)` — prompt do agente de operação: 1 bloco de tags
    disponíveis (vendedor ou comprador) ou os 2 juntos pros demais tipos, mais as regras especiais
    aplicáveis e a descrição do `tipo_cliente`.
  - `buildSpecialTagsSystemPrompt(priorityTags, dates)` — prompt do agente de tags especiais:
    `CRITICAL_TAGS` + títulos/descrições das tags "priority" do HiveOps, sem depender de
    `tipo_cliente`.
- `tags-agent.ts` — `tagsAgent` (registrado em `mastra-instance.ts`), `buildDateThresholds` (calcula
  hoje/+2/+3/+5 dias em código — nunca deixar o modelo fazer essa conta, reaproveitado por
  `special-tags-agent.ts`) e `classifyHandoffTags(transcript, customerType)`.
- `special-tags-agent.ts` — `specialTagsAgent` (registrado em `mastra-instance.ts`) e
  `classifySpecialTags(transcript)`: busca as tags "priority" do HiveOps, monta o prompt e chama
  `specialTagsAgent.generate(...)`.

## Notas de desenvolvimento

- As instruções de ambos os agents são dinâmicas por chamada (tags de operação dependem de
  `tipo_cliente` e da data de hoje; tags especiais dependem das tags "priority" do HiveOps e da
  data) — por isso os dois são criados com instrução/schema placeholder e cada chamada passa
  `instructions` + `structuredOutput` via `generate()`, em vez de um prompt fixo no construtor
  (padrão diferente dos outros agents de `agents/`, que têm prompt estático).
- Os `structuredOutput.schema` dos construtores (`tabulacaoOutputSchema`,
  `buildSpecialTagsOutputSchema([])`) são só placeholder — aceitam qualquer tag/lista vazia de
  priority tags. Se `classifyHandoffTags`/`classifySpecialTags` dependessem só deles, o enum nunca
  barraria uma tag fora de escopo (ex.: o modelo escolher `saque`, tag de vendedor, numa conversa de
  comprador) — só o texto do prompt pedia a lista certa, e isso já vazou na prática pro agente de
  operação. Por isso os dois helpers sempre passam `structuredOutput: { schema: build...() }` no
  `generate()`, sobrescrevendo o placeholder com o enum certo da chamada.
- Os agents retornam 0, N ou todas as tags aplicáveis — nunca "a melhor". Por isso a saída é
  `{ tags: string[] }` (não `{ tag: ... | null }`) e todos os consumidores downstream
  (`handoff-tags.ts`, `routes/zendesk-webhook.ts`) recebem/passam array, não valor único.
  `classifyHandoffTags`/`classifySpecialTags` deduplicam o array retornado (`[...new Set(...)]`) —
  o prompt já pede pra não duplicar, isso é só a garantia em código.
- `dataCapture.ticketField.<id>` de id_pedido e conversation_id já estão em
  `webhooks/zendesk/ticket-fields.ts` (`buildHandoffTicketFields`). Ainda falta o de
  `motivo_contato` (e outros que o time de suporte mandar) — quando o ID do campo chegar, adicionar
  lá, não aqui.
- Se aparecer uma regra própria pra algum dos tipos que hoje caem no merge (improdutivo,
  parceiro_afiliado, imprensa, funcionario), adicione uma chave nova em
  `TABULACAO_TAGS_BY_CUSTOMER_TYPE` (`schema.ts`) e trate esse tipo à parte em
  `buildTabulacaoOutputSchema` e em `buildSystemPrompt`, do mesmo jeito que vendedor/comprador.
