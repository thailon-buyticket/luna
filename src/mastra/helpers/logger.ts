const PREFIX = '[zendesk-webhook]';

export function logConversation(conversationId: string, message: string): void {
  console.log(`${PREFIX} [conversa ${conversationId}] ${message}`);
}

export function logConversationError(conversationId: string, message: string, error: unknown): void {
  console.error(`${PREFIX} [conversa ${conversationId}] ${message}`, error);
}
