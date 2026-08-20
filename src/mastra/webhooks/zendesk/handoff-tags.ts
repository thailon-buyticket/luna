import type { LunaWorkingMemory } from '../../agents/luna-working-memory/schema';
import type { TabulacaoTag } from '../../agents/tags/schema';

// Tags mandadas em toda transferência pra humano — viram `dataCapture.systemField.tags` no
// `passControl` (ver `zendesk.ts`). "luna" e "luna-transferencia" identificam a origem do handoff;
// as demais dependem do que a Luna já sabe sobre a conversa (working memory), do motivo da
// transferência e da tag de tabulação escolhida pelo `tagsAgent` (`agents/tags/`, só pra
// vendedor/comprador — ver `classifyHandoffTag`). Os ticket fields (id_pedido, motivo_contato etc,
// que precisam do ID do campo no Zendesk) ainda serão adicionados aqui.
const BASE_HANDOFF_TAGS = ['luna', 'luna-transferencia'];

export function buildHandoffTags(
  reason: string | null,
  workingMemory: LunaWorkingMemory | null,
  tabulacaoTag?: TabulacaoTag | null,
): string[] {
  const tags = new Set(BASE_HANDOFF_TAGS);
  if (reason) tags.add(reason);
  if (workingMemory?.tipo_cliente) tags.add(workingMemory.tipo_cliente);
  if (workingMemory?.evento_hoje) tags.add('evento_hoje');
  if (tabulacaoTag) tags.add(tabulacaoTag);
  return [...tags];
}
