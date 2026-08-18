import { Agent } from '@mastra/core/agent';
import { buildSystemPrompt } from './prompts/system-prompt';
import { lunaWorkingMemoryUpdateSchema } from './schema';

export const lunaWorkingMemoryAgent = new Agent({
  id: 'luna-working-memory',
  name: 'Luna Working Memory',
  description: 'Decide o que deve ser adicionado, atualizado ou removido na working memory da Luna a partir da última troca de mensagens.',
  instructions: buildSystemPrompt(),
  model: 'openai/gpt-5.6-luna',
  defaultOptions: {
    structuredOutput: {
      schema: lunaWorkingMemoryUpdateSchema,
    },
  },
});
