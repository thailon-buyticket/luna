import type { LunaWorkingMemory } from '../../agents/luna-working-memory/schema';

// Tags mandadas em toda transferência pra humano — viram `dataCapture.systemField.tags` no
// `passControl` (ver `zendesk.ts`). "luna" e "luna-transferencia" identificam a origem do handoff;
// as demais dependem do que a Luna já sabe sobre a conversa (working memory), do motivo da
// transferência e das tags escolhidas pelos 2 agentes de `agents/tags/` (tags de operação +
// especiais/críticas — ver `resolveTabulacaoTags` em `routes/zendesk-webhook.ts`). `string[]` e
// não `TabulacaoTag[]` porque as tags especiais incluem títulos configuráveis no HiveOps, fora do
// enum fixo de tabulação. Os ticket fields (id_pedido, motivo_contato etc, que precisam do ID do
// campo no Zendesk) ainda serão adicionados aqui.
const BASE_HANDOFF_TAGS = ['luna', 'luna-transferencia'];

export function buildHandoffTags(
  reason: string | null,
  workingMemory: LunaWorkingMemory | null,
  tabulacaoTags?: readonly string[] | null,
): string[] {
  const tags = new Set(BASE_HANDOFF_TAGS);
  if (reason) tags.add(reason);
  if (workingMemory?.tipo_cliente) tags.add(workingMemory.tipo_cliente);
  if (workingMemory?.evento_hoje) tags.add('evento_hoje');
  for (const tag of tabulacaoTags ?? []) tags.add(tag);
  return [...tags];
}
