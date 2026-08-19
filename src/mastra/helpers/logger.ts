const PREFIX = '[zendesk-webhook]';

function timestamp(): string {
  return new Date().toISOString();
}

export function logConversation(conversationId: string, message: string): void {
  console.log(`${PREFIX} [${timestamp()}] [conversa ${conversationId}] ${message}`);
}

export function logConversationError(conversationId: string, message: string, error: unknown): void {
  console.error(`${PREFIX} [${timestamp()}] [conversa ${conversationId}] ${message}`, error);
}
