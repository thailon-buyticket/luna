import { RequestContext } from '@mastra/core/request-context';
import type { GuardrailOutput } from '../luna-guardrail/schema';
import type { LunaWorkingMemory } from '../luna-working-memory/schema';
import { luna } from './luna-agent';
import { buildExchanges, type MessageExchange } from './memory/transcript';
import { LunaGuardrail } from '../luna-guardrail/luna-guardrail';
import { logConversationError } from '../../helpers/logger';

// A OpenAI (Responses API) referencia, nos bastidores, o último item de resposta salvo na
// thread — se esse item já não existir mais do lado dela (retenção expirada, por exemplo), toda
// tentativa de continuar a thread falha com esse erro exato, pra sempre, já que a referência
// quebrada fica presa no histórico salvo. Não tem retentativa que resolva isso.
const STALE_RESPONSE_ITEM_ERROR = /item with id .+ not found/i;

function isStaleResponseItemError(error: unknown): boolean {
  return error instanceof Error && STALE_RESPONSE_ITEM_ERROR.test(error.message);
}

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

// O resourceId que quem chama calcula (ex.: telefone do Zendesk) é só um palpite pra thread nova.
// Se a thread já existe, o Mastra trava a resposta caso o resourceId não bata com o dono
// original (`AGENT_MEMORY_THREAD_RESOURCE_MISMATCH`) — e o telefone resolvido por webhook pode
// variar entre mensagens da mesma conversa (ex.: campo bruto do provedor às vezes vem com o id
// da mensagem em vez do telefone). Pra não depender de acertar o resourceId toda vez, sempre
// usamos o dono já gravado na thread quando ela existir.
async function resolveMemoryOptions(memory: { thread: string; resource: string }): Promise<{ thread: string; resource: string }> {
  const lunaMemory = await luna.getMemory();
  if (!lunaMemory) return memory;

  const existingThread = await lunaMemory.getThreadById({ threadId: memory.thread });
  if (!existingThread) return memory;

  return { thread: memory.thread, resource: existingThread.resourceId };
}

async function generateAnswer(
  message: string,
  memory: { thread: string; resource: string } | undefined,
  requestContext: Record<string, unknown> | undefined,
): Promise<LunaAskResult> {
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

async function ask(message: string, options: LunaAskOptions = {}): Promise<LunaAskResult> {
  const { requestContext } = options;
  const memory = options.memory ? await resolveMemoryOptions(options.memory) : undefined;

  try {
    return await generateAnswer(message, memory, requestContext);
  } catch (error) {
    if (!memory || !isStaleResponseItemError(error)) throw error;

    // A thread ficou travada numa referência de resposta que a OpenAI já não reconhece mais —
    // não adianta tentar de novo do mesmo jeito. Descarta a thread (perde o histórico salvo
    // dessa conversa) e responde de novo como se fosse a primeira mensagem dela.
    logConversationError(memory.thread, 'Thread presa em referência de resposta expirada na OpenAI, reiniciando', error);
    const lunaMemory = await luna.getMemory();
    if (lunaMemory) await lunaMemory.deleteThread(memory.thread);
    return generateAnswer(message, memory, requestContext);
  }
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

export const Luna = { id: 'Luna', ask, getMessageHistory};
