import { env } from '../../config/env';
import { requireEnv } from '../../config/require-env';
import { zendeskConversationsRequest } from '../../services/zendesk';
import type { ZendeskConversationMessagePayload, ZendeskMessage, ZendeskMessageContent } from './schema';

const BUSINESS_AUTHOR = {
  type: 'business',
  displayName: 'Suporte BuyTicket - Luna',
  avatarUrl: 'https://buyticket.zendesk.com/flow_composer/assets/bot-avatar/01J6ZVKVXSQC3TN0QC4SNQJ12W',
};

// Provedor Zendesk (Sunshine Conversations/Smooch) usado na integração de WhatsApp: mensageria
// e handoff pro time humano. Mecânica pura do Zendesk — nenhuma regra de negócio (horário,
// aviso de handoff) mora aqui, isso é responsabilidade de quem chama (ver `business/buyticket.ts`).
export const zendesk = {
  async sendMessage(appId: string, conversationId: string, text: string): Promise<void> {
    await zendeskConversationsRequest(appId, `conversations/${conversationId}/messages`, {
      method: 'POST',
      body: { author: BUSINESS_AUTHOR, content: { type: 'text', text } },
    });
  },

  // `tags` vira `dataCapture.systemField.tags` no Zendesk (string separada por vírgula) e
  // `ticketFields` vira um `dataCapture.ticketField.<id>` por entrada — usado pelo time de suporte
  // pra tabular o atendimento. Quem monta os dois é `handoff-tags.ts`/`ticket-fields.ts`, nunca
  // esta função — aqui só serializa pro formato que o Zendesk espera.
  async connectHuman(
    appId: string,
    conversationId: string,
    options: { tags?: string[]; ticketFields?: Record<string, string> } = {},
  ): Promise<void> {
    const { ZENDESK_HUMAN_SWITCHBOARD_ID } = requireEnv(
      { ZENDESK_HUMAN_SWITCHBOARD_ID: env.ZENDESK_HUMAN_SWITCHBOARD_ID },
      'Zendesk human switchboard',
    );

    const metadata: Record<string, string> = { lang: 'pt-br' };
    if (options.tags?.length) {
      metadata['dataCapture.systemField.tags'] = options.tags.join(',');
    }
    for (const [fieldId, value] of Object.entries(options.ticketFields ?? {})) {
      metadata[`dataCapture.ticketField.${fieldId}`] = value;
    }

    await zendeskConversationsRequest(appId, `conversations/${conversationId}/passControl`, {
      method: 'POST',
      body: { switchboardIntegration: ZENDESK_HUMAN_SWITCHBOARD_ID, metadata },
    });
  },

  async connectAIAgent(appId: string, conversationId: string): Promise<void> {
    const { ZENDESK_AI_AGENT_SWITCHBOARD_ID } = requireEnv(
      { ZENDESK_AI_AGENT_SWITCHBOARD_ID: env.ZENDESK_AI_AGENT_SWITCHBOARD_ID },
      'Zendesk AI agent switchboard',
    );

    await zendeskConversationsRequest(appId, `conversations/${conversationId}/passControl`, {
      method: 'POST',
      body: { switchboardIntegration: ZENDESK_AI_AGENT_SWITCHBOARD_ID, metadata: { lang: 'pt-br' } },
    });
  },
};

// O que a Luna precisa saber sobre o conteúdo da mensagem pra virar texto — ver `parseMessageToText`
// em `message-normalizer.ts`. Resolvido aqui, uma vez, pra quem consome `NormalizedZendeskMessage`
// nunca precisar voltar no payload bruto do webhook.
export type MediaType = 'text' | 'image' | 'video' | 'sticker' | 'audio' | 'file';

function resolveMediaType(content: ZendeskMessageContent): MediaType {
  if (content.type === 'text') return 'text';
  if (content.type === 'image') return 'image';
  if (content.type === 'videoMessage') return 'video';
  if (content.type === 'stickerMessage') return 'sticker';
  // Áudio do WhatsApp costuma chegar com content.type "file" e mediaType "audio/ogg" — por isso
  // é detectado pelo mediaType, checado antes do fallback genérico de arquivo.
  if (content.mediaType === 'audio/ogg') return 'audio';
  return 'file';
}

export interface NormalizedZendeskMessage {
  appId: string;
  conversationId: string;
  messageId: string;
  userId: string | undefined;
  userName: string | undefined;
  mediaType: MediaType;
  mediaUrl: string | undefined;
  additionalText: string;
  userPhone: string | null;
  externalId: string | undefined;
  messageTimestamp: string;
  isFromCompany: boolean;
}

export function normalizeIncomingMessage(
  appId: string,
  { conversation, message }: ZendeskConversationMessagePayload,
): NormalizedZendeskMessage {
  return {
    appId,
    conversationId: conversation.id,
    messageId: message.id,
    userId: message.author.userId,
    userName: message.author.displayName,
    mediaType: resolveMediaType(message.content),
    mediaUrl: message.content.mediaUrl,
    additionalText: message.content.text ?? '',
    userPhone: resolveUserPhone(message),
    externalId: message.source?.client?.externalId,
    messageTimestamp: message.received,
    isFromCompany: message.author.type === 'business',
  };
}

function resolveUserPhone(message: ZendeskMessage): string | null {
  return message.source?.client?.additionalIdentifiers?.[0]?.value ?? message.source?.client?.raw?.from ?? null;
}
