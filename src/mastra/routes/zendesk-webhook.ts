import { registerApiRoute } from '@mastra/core/server';
import type { ContextWithMastra } from '@mastra/core/server';
import { conversationMessageSchema, zendeskWebhookSchema } from '../webhooks/zendesk';
import { logConversationError } from '../webhooks/zendesk/logger';
import { prepareZendeskMessage } from '../webhooks/zendesk/prepare-ask-luna-call';
import type { ZendeskConversationMessagePayload } from '../webhooks/zendesk/schema';
import { parseOrBadRequest } from './validate';

export const zendeskWebhookRoute = registerApiRoute('/webhooks/zendesk', {
  method: 'POST',
  openapi: {
    summary: 'Recebe eventos de conversa do Zendesk (WhatsApp)',
    description:
      'Webhook chamado pelo Zendesk a cada mensagem de uma conversa. Identifica se é da empresa ou do ' +
      'cliente, verifica bloqueio e o estado da conversa e, se for o caso, dispara o workflow `ask-luna` em ' +
      'background — o buffer/debounce de mensagens próximas no tempo é feito por fora. O workflow aciona a ' +
      'Luna e aplica a decisão do guardrail (responder e/ou transferir para um humano).',
    tags: ['Zendesk'],
  },
  handler: async (c) => {
    const parsed = parseOrBadRequest(zendeskWebhookSchema, await c.req.json(), c);
    if (parsed instanceof Response) return parsed;

    // Nunca espera o processamento terminar: a resposta ao Zendesk tem que ser imediata,
    // independente de quanto tempo o Supabase/Zendesk/Luna demorem para essa mensagem.
    for (const event of parsed.events) {
      const message = conversationMessageSchema.safeParse(event.payload);
      if (!message.success) continue;

      void startAskLunaWorkflow(c, parsed.app.id, message.data);
    }

    return c.json({ received: true });
  },
});

async function startAskLunaWorkflow(
  c: ContextWithMastra,
  appId: string,
  payload: ZendeskConversationMessagePayload,
): Promise<void> {
  try {
    const prepared = await prepareZendeskMessage(appId, payload);
    if (!prepared.shouldAskLuna) return;

    const workflow = c.get('mastra').getWorkflow('askLunaWorkflow');
    const run = await workflow.createRun();
    await run.startAsync({ inputData: prepared.input });
  } catch (error) {
    logConversationError(payload.conversation.id, 'failed to start ask-luna workflow', error);
  }
}
