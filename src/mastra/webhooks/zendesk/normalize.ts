import type { ZendeskConversationMessagePayload, ZendeskMessage } from './schema';

export interface NormalizedZendeskMessage {
  appId: string;
  conversationId: string;
  messageId: string;
  userId: string | undefined;
  userName: string | undefined;
  userMessage: string;
  userPhone: string | null;
  externalId: string | undefined;
  messageType: string;
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
    userMessage: message.content.text ?? '',
    userPhone: resolveUserPhone(message),
    externalId: message.source?.client?.externalId,
    messageType: message.content.type,
    messageTimestamp: message.received,
    isFromCompany: message.author.type === 'business',
  };
}

function resolveUserPhone(message: ZendeskMessage): string | null {
  return message.source?.client?.additionalIdentifiers?.[0]?.value ?? message.source?.client?.raw?.from ?? null;
}
