import { env } from '../../config/env';
import { logConversationError } from './logger';

const DEFAULT_BUFFER_WINDOW_MS = 8000;
const BUFFER_WINDOW_MS = env.LUNA_MESSAGE_BUFFER_MS ?? DEFAULT_BUFFER_WINDOW_MS;

interface PendingBuffer {
  chunks: Promise<string>[];
  timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, PendingBuffer>();

// Acumula mensagens próximas no tempo pra uma mesma conversa e só aciona `onFlush` depois
// que a conversa ficar `BUFFER_WINDOW_MS` sem mensagem nova (debounce clássico). Evita que
// vários textos seguidos do cliente virem várias respostas separadas da Luna.
//
// `textPromise` roda em paralelo com o próprio timer: mensagens de mídia (áudio, imagem)
// entram no buffer antes de terminar a análise, então o tempo de espera final é o maior
// entre "o timer estourou" e "a análise terminou" — nunca a soma dos dois.
export function pushMessage(
  conversationId: string,
  textPromise: Promise<string>,
  onFlush: (combinedText: string) => Promise<void>,
): void {
  // A promise só é aguardada de verdade quando o timer estourar, lá na frente — sem isso, uma
  // falha na análise (ex.: erro na transcrição/visão) viraria um unhandled rejection e poderia
  // derrubar o processo antes mesmo do buffer estourar. O tratamento real continua em `flush`.
  textPromise.catch(() => {});

  const existing = pending.get(conversationId);
  const chunks = existing ? [...existing.chunks, textPromise] : [textPromise];
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    pending.delete(conversationId);
    flush(conversationId, chunks, onFlush);
  }, BUFFER_WINDOW_MS);

  pending.set(conversationId, { chunks, timer });
}

export function cancelBuffer(conversationId: string): void {
  const existing = pending.get(conversationId);
  if (!existing) return;
  clearTimeout(existing.timer);
  pending.delete(conversationId);
}

async function flush(
  conversationId: string,
  chunks: Promise<string>[],
  onFlush: (combinedText: string) => Promise<void>,
): Promise<void> {
  try {
    const texts = await Promise.all(chunks);
    await onFlush(texts.join('\n'));
  } catch (error) {
    logConversationError(conversationId, 'failed to process buffered messages', error);
  }
}
