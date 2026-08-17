import { z } from 'zod';

// Formato do webhook de conversas do Zendesk (Sunshine Conversations), usado na integração
// de WhatsApp. Cada evento só traz `payload.message` + `payload.conversation`, sem um campo
// de tipo — a assinatura do webhook em si já é escopada pro evento de mensagem.

const authorSchema = z.object({
  type: z.enum(['user', 'business']),
  userId: z.string().optional(),
  displayName: z.string().optional(),
});

// `type` fica solto (não é um enum fechado): conteúdo que a gente ainda não trata cai em
// "unsupported" no attachment-router em vez de derrubar a validação do payload inteiro.
const messageContentSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
  mediaUrl: z.string().optional(),
  mediaType: z.string().optional(),
});

// `additionalIdentifiers` é onde o telefone do WhatsApp normalmente vem; `raw.from` é o dado
// bruto do provedor e serve de fallback quando o identifier normalizado não vier.
const sourceSchema = z.object({
  type: z.string().optional(),
  client: z
    .object({
      raw: z.object({ from: z.string().optional() }).optional(),
      additionalIdentifiers: z.array(z.object({ type: z.string().optional(), value: z.string().optional() })).optional(),
      externalId: z.string().optional(),
    })
    .optional(),
});

export const conversationMessageSchema = z.object({
  conversation: z.object({ id: z.string() }),
  message: z.object({
    id: z.string(),
    received: z.string(),
    author: authorSchema,
    content: messageContentSchema,
    source: sourceSchema.optional(),
  }),
});

const webhookEventSchema = z.object({
  payload: z.unknown(),
});

export const zendeskWebhookSchema = z.object({
  app: z.object({ id: z.string() }),
  events: z.array(webhookEventSchema),
});

export type ZendeskConversationMessagePayload = z.infer<typeof conversationMessageSchema>;
export type ZendeskMessage = ZendeskConversationMessagePayload['message'];
export type ZendeskMessageAuthor = z.infer<typeof authorSchema>;
export type ZendeskMessageContent = z.infer<typeof messageContentSchema>;
