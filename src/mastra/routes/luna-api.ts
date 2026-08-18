import { registerApiRoute } from '@mastra/core/server';
import { z } from 'zod';
import { Luna, parseWorkingMemory } from '../agents/luna/ask';
import { buildExchanges } from '../agents/luna/memory/transcript';
import { parseOrBadRequest } from './validate';

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

export const lunaAsk = registerApiRoute('/luna/ask', {
  method: 'POST',
  openapi: {
    summary: 'Gera a resposta da Luna para uma mensagem de cliente',
    description:
      'Endpoint simplificado para integrações externas (ex: n8n). Retorna a resposta pronta pro cliente ' +
      'e o resultado do guardrail em um único JSON plano.',
    tags: ['Luna'],
  },
  handler: async (c) => {
    const parsed = parseOrBadRequest(bodySchema, await c.req.json(), c);
    if (parsed instanceof Response) return parsed;
    const { messages, memory, requestContext } = parsed;

    const { answer, guardrail, working_memory } = await Luna.ask(messages, { memory, requestContext });

    return c.json({ answer, guardrail, working_memory });
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
    const parsed = parseOrBadRequest(
      historyQuerySchema,
      { thread: c.req.query('thread'), resource: c.req.query('resource') },
      c,
    );
    if (parsed instanceof Response) return parsed;
    const { thread, resource } = parsed;

    const luna = c.get('mastra').getAgent('luna');
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

    return c.json({
      history: buildExchanges(messages),
      working_memory: parseWorkingMemory(workingMemoryRaw),
    });
  },
});
