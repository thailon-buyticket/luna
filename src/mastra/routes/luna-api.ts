import { registerApiRoute } from '@mastra/core/server';
import { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod';
import type { GuardrailOutput } from '../agents/luna-guardrail/schema';
import { buildExchanges } from '../agents/luna/memory/transcript';
import type { LunaWorkingMemory } from '../agents/luna-working-memory/schema';

const bodySchema = z.object({
  messages: z.string(),
  memory: z
    .object({
      thread: z.string(),
      resource: z.string(),
    })
    .optional(),
  requestContext: z.record(z.string(), z.unknown()).optional(),
});

export const lunaReplyRoute = registerApiRoute('/luna/ask', {
  method: 'POST',
  openapi: {
    summary: 'Gera a resposta da Luna para uma mensagem de cliente',
    description:
      'Endpoint simplificado para integrações externas (ex: n8n). Retorna a resposta pronta pro cliente ' +
      'e o resultado do guardrail em um único JSON plano.',
    tags: ['Luna'],
  },
  handler: async (c) => {
    const parsed = bodySchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400);
    }
    const { messages, memory, requestContext } = parsed.data;

    const mastra = c.get('mastra');
    const luna = mastra.getAgent('luna');
    const result = await luna.generate(messages, {
      memory,
      requestContext: new RequestContext(Object.entries(requestContext ?? {})),
    });

    const assistantMessage = result.response?.uiMessages?.find((message) => message.role === 'assistant');
    const metadata = assistantMessage?.metadata as { guardrail?: GuardrailOutput } | undefined;
    const guardrail = metadata?.guardrail ?? null;

    const lunaMemory = await luna.getMemory();
    const workingMemoryRaw =
      memory && lunaMemory
        ? await lunaMemory.getWorkingMemory({ threadId: memory.thread, resourceId: memory.resource })
        : null;
    const workingMemory = workingMemoryRaw ? (JSON.parse(workingMemoryRaw) as LunaWorkingMemory) : null;

    return c.json({
      answer: result.text ?? null,
      guardrail,
      working_memory: workingMemory,
    });
  },
});

const historyQuerySchema = z.object({
  thread: z.string(),
  resource: z.string(),
});

export const lunaHistoryRoute = registerApiRoute('/luna/history', {
  method: 'GET',
  openapi: {
    summary: 'Retorna o histórico da conversa e a working memory da Luna',
    description:
      'Endpoint somente leitura, sem gerar nenhuma resposta nova. Retorna a conversa completa como um array ' +
      'de trocas { user_message, bot_answer } e o estado atual da working memory pro resource informado.',
    tags: ['Luna'],
  },
  handler: async (c) => {
    const parsed = historyQuerySchema.safeParse({
      thread: c.req.query('thread'),
      resource: c.req.query('resource'),
    });
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400);
    }
    const { thread, resource } = parsed.data;

    const mastra = c.get('mastra');
    const luna = mastra.getAgent('luna');
    const lunaMemory = await luna.getMemory();
    if (!lunaMemory) {
      return c.json({ error: 'memory_not_configured' }, 500);
    }

    const existingThread = await lunaMemory.getThreadById({ threadId: thread });
    if (!existingThread) {
      return c.json({ history: [], working_memory: null });
    }
    if (existingThread.resourceId !== resource) {
      return c.json(
        {
          error: 'resource_mismatch',
          message: `A thread '${thread}' pertence ao resource '${existingThread.resourceId}', não '${resource}'.`,
        },
        400,
      );
    }

    const [{ messages }, workingMemoryRaw] = await Promise.all([
      lunaMemory.recall({ threadId: thread, resourceId: resource }),
      lunaMemory.getWorkingMemory({ threadId: thread, resourceId: resource }),
    ]);

    const history = buildExchanges(messages);
    const workingMemory = workingMemoryRaw ? (JSON.parse(workingMemoryRaw) as LunaWorkingMemory) : null;

    return c.json({
      history,
      working_memory: workingMemory,
    });
  },
});
