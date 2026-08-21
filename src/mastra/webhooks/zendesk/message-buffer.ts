import { env } from '../../config/env';
import { logConversationError } from '../../helpers/logger';
import type { AskLunaInput } from './schema';

const DEFAULT_BUFFER_MS = 35000;

interface PendingConversation {
  messages: AskLunaInput[];
  timer: ReturnType<typeof setTimeout>;
}

const pendingByConversation = new Map<string, PendingConversation>();

// O WhatsApp costuma entregar uma ideia do cliente como várias mensagens curtas em sequência,
// cada uma chegando como um webhook separado do Zendesk. Em vez de perguntar pra Luna a cada
// mensagem, espera um intervalo sem mensagens novas na mesma conversa — se uma mensagem nova
// chega antes do intervalo acabar, o timer reinicia — e só então junta tudo em uma única pergunta.
export function bufferMessage(input: AskLunaInput, onFlush: (merged: AskLunaInput) => Promise<void>): void {
  const pending = pendingByConversation.get(input.conversationId);
  if (pending) clearTimeout(pending.timer);

  const messages = [...(pending?.messages ?? []), input];
  const timer = setTimeout(() => {
    pendingByConversation.delete(input.conversationId);
    const merged = mergeMessages(messages);
    onFlush(merged).catch((error) => logConversationError(merged.conversationId, 'falha ao processar buffer de mensagens', error));
  }, env.LUNA_MESSAGE_BUFFER_MS ?? DEFAULT_BUFFER_MS);

  pendingByConversation.set(input.conversationId, { messages, timer });
}

function mergeMessages(messages: AskLunaInput[]): AskLunaInput {
  const [first] = messages;
  return { ...first, message: messages.map((item) => item.message).join('\n') };
}
