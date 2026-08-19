import type { MastraDBMessage } from '@mastra/core/memory';
import { extractUserMessageFromContextPrompt } from '../prompts/context-prompt';

export function getMessageText(message: MastraDBMessage): string {
  return message.content.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join(' ');
}

export function messagesToTranscript(messages: MastraDBMessage[]): string {
  return messages
    .map((message) => {
      const rawText = getMessageText(message);
      if (!rawText) return undefined;
      const text = message.role === 'user' ? extractUserMessageFromContextPrompt(rawText) : rawText;
      return `${message.role}: ${text}`;
    })
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

export type MessageExchange = { user_message: string; bot_answer: string };

// Agrupa mensagens em pares { user_message, bot_answer } (várias mensagens de assistant
// dentro do mesmo turno, ex: passos de tool call, são concatenadas num único bot_answer).
// Tira o embrulho de contexto (habilidades/bases/incidências) da mensagem do usuário.
// `limit` corta pras últimas N trocas; omitido retorna a conversa inteira.
export function buildExchanges(messages: MastraDBMessage[], limit?: number): MessageExchange[] {
  const exchanges: MessageExchange[] = [];
  let current: MessageExchange | undefined;

  for (const message of messages) {
    const text = getMessageText(message);
    if (!text) continue;

    if (message.role === 'user') {
      if (current) exchanges.push(current);
      current = { user_message: extractUserMessageFromContextPrompt(text), bot_answer: '' };
    } else if (message.role === 'assistant' && current) {
      current.bot_answer = current.bot_answer ? `${current.bot_answer} ${text}` : text;
    }
  }
  if (current) exchanges.push(current);

  return limit ? exchanges.slice(-limit) : exchanges;
}
