import { registerApiRoute } from '@mastra/core/server';
import { conversationMessageSchema, handleConversationMessage, zendeskWebhookSchema } from '../webhooks/zendesk';

export const zendeskWebhookRoute = registerApiRoute('/webhooks/zendesk', {
  method: 'POST',
  openapi: {
    summary: 'Recebe eventos de conversa do Zendesk (WhatsApp)',
    description:
      'Webhook chamado pelo Zendesk a cada mensagem de uma conversa. Identifica se a mensagem é do cliente ' +
      'ou da empresa, verifica bloqueio e histórico do contato, roteia o tipo de conteúdo recebido, ' +
      'bufferiza mensagens próximas no tempo e aciona a Luna, aplicando a decisão do guardrail ' +
      '(responder e/ou transferir para um humano).',
    tags: ['Zendesk'],
  },
  handler: async (c) => {
    const parsed = zendeskWebhookSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400);
    }

    // Nunca espera o processamento terminar: a resposta ao Zendesk tem que ser imediata,
    // independente de quanto tempo o Supabase/Zendesk/Luna demorem para essa mensagem.
    // `handleConversationMessage` captura os próprios erros, então não rejeita.
    for (const event of parsed.data.events) {
      const message = conversationMessageSchema.safeParse(event.payload);
      if (!message.success) continue;

      void handleConversationMessage(parsed.data.app.id, message.data);
    }

    return c.json({ received: true });
  },
});
