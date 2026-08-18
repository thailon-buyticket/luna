import { RequestContext } from '@mastra/core/request-context';
import type { GuardrailOutput } from '../luna-guardrail/schema';
import type { LunaWorkingMemory } from '../luna-working-memory/schema';
import { luna } from './luna-agent';
import { buildExchanges, type MessageExchange } from './memory/transcript';
import { LunaGuardrail } from '../luna-guardrail/luna-guardrail';

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

async function ask(message: string, options: LunaAskOptions = {}): Promise<LunaAskResult> {
  const { memory, requestContext } = options;

  const result = await luna.generate(message, {
    memory,
    requestContext: new RequestContext(Object.entries(requestContext ?? {})),
  });

  const guardrail = LunaGuardrail.extractOutput(result);

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

type LunaHistoryResult =
  | { status: 'ok'; history: MessageExchange[]; working_memory: LunaWorkingMemory | null }
  | { status: 'not_found' }
  | { status: 'resource_mismatch'; actualResource: string };

// Leitura pura do histórico + working memory de uma thread, sem gerar nenhuma resposta nova.
async function getMessageHistory(thread: string, resource: string): Promise<LunaHistoryResult> {
  const lunaMemory = await luna.getMemory();
  if (!lunaMemory) {
    throw new Error('memory_not_configured');
  }

  const existingThread = await lunaMemory.getThreadById({ threadId: thread });
  if (!existingThread) {
    return { status: 'not_found' };
  }
  if (existingThread.resourceId !== resource) {
    return { status: 'resource_mismatch', actualResource: existingThread.resourceId };
  }

  const [{ messages }, workingMemoryRaw] = await Promise.all([
    lunaMemory.recall({ threadId: thread, resourceId: resource }),
    lunaMemory.getWorkingMemory({ threadId: thread, resourceId: resource }),
  ]);

  return {
    status: 'ok',
    history: buildExchanges(messages),
    working_memory: parseWorkingMemory(workingMemoryRaw),
  };
}

export const Luna = { ask, getMessageHistory };
