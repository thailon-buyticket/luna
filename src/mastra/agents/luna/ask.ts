import { RequestContext } from '@mastra/core/request-context';
import { extractGuardrailOutput } from '../luna-guardrail/extract-metadata';
import type { GuardrailOutput } from '../luna-guardrail/schema';
import type { LunaWorkingMemory } from '../luna-working-memory/schema';
import { luna } from './luna-agent';

export function parseWorkingMemory(raw: string | null): LunaWorkingMemory | null {
  return raw ? (JSON.parse(raw) as LunaWorkingMemory) : null;
}

type LunaAskOptions = {
  memory?: { thread: string; resource: string };
  requestContext?: Record<string, unknown>;
};

type LunaAskResult = {
  answer: string | null;
  guardrail: GuardrailOutput | null;
  working_memory: LunaWorkingMemory | null;
};

// Ponto único pra falar com a Luna: gera a resposta, tira o veredito do guardrail (metadata
// da outputProcessor) e a working memory atual — usado tanto pela rota /luna/ask quanto pelos
// workflows (ex: ask-luna-workflow), sem duplicar a chamada ao agente em cada lugar.
async function ask(message: string, options: LunaAskOptions = {}): Promise<LunaAskResult> {
  const { memory, requestContext } = options;

  const result = await luna.generate(message, {
    memory,
    requestContext: new RequestContext(Object.entries(requestContext ?? {})),
  });

  const guardrail = extractGuardrailOutput(result);

  const lunaMemory = await luna.getMemory();
  const workingMemoryRaw =
    memory && lunaMemory
      ? await lunaMemory.getWorkingMemory({ threadId: memory.thread, resourceId: memory.resource })
      : null;

  return {
    answer: result.text?.trim() ?? null,
    guardrail,
    working_memory: parseWorkingMemory(workingMemoryRaw),
  };
}

export const Luna = { ask };
