import { Agent } from '@mastra/core/agent';
import { getHiveOps } from '../../hiveops';
import { buildDateThresholds } from './tags-agent';
import { buildSpecialTagsSystemPrompt } from './prompts/system-prompt';
import { buildSpecialTagsOutputSchema } from './schema';

// Segundo dos 2 agentes de tags (ver `agents/tags/AGENTS.md`) — reavalia as tags críticas/
// prioritárias (evento_hoje, cadastro de evento e as configuradas no HiveOps) independente do
// `tipo_cliente`, em paralelo ao `tagsAgent` de tags de operação (`tags-agent.ts`).
export const specialTagsAgent = new Agent({
  id: 'special-tags',
  name: 'Special Tags',
  description:
    'Reavalia as tags críticas/prioritárias do atendimento (evento_hoje, cadastro de evento e as tags "priority" do HiveOps), independente do tipo de cliente, pra mandar pro Zendesk no handoff.',
  // Mesmo padrão de instruction/schema placeholder do `tagsAgent` (`tags-agent.ts`) — a instrução e
  // o enum de verdade dependem da data de hoje e das tags "priority" do HiveOps (dinâmicas), então
  // são montados por chamada em `classifySpecialTags` e passados no `generate()`.
  instructions: 'Aguardando instruções específicas do atendimento.',
  model: 'openai/gpt-4.1-mini',
  defaultOptions: {
    structuredOutput: {
      schema: buildSpecialTagsOutputSchema([]),
    },
  },
});

export async function classifySpecialTags(transcript: string): Promise<string[]> {
  const priorityTags = await getHiveOps().getPriorityTags();
  const instructions = buildSpecialTagsSystemPrompt(priorityTags, buildDateThresholds(new Date()));
  const { object } = await specialTagsAgent.generate(transcript, {
    instructions,
    structuredOutput: { schema: buildSpecialTagsOutputSchema(priorityTags.map((tag) => tag.title)) },
  });
  return [...new Set(object.tags)];
}
