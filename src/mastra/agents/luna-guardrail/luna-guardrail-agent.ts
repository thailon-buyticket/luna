import { Agent } from '@mastra/core/agent';
import { buildGuardrailPrompt } from './prompts/system-prompt';
import { guardrailOutputSchema } from './schema';

export const lunaGuardrail = new Agent({
  id: 'luna-guardrail',
  name: 'Luna Guardrail',
  description: 'Classifica cada resposta da Luna (reply | connect_human | reply_and_connect_human).',
  instructions: () => buildGuardrailPrompt(new Date()),
  model: 'openai/gpt-5.6-luna',
  defaultOptions: {
    structuredOutput: {
      schema: guardrailOutputSchema,
    },
  },
});
