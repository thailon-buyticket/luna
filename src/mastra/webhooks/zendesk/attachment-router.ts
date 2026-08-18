import { analyzeDocument } from '../../agents/luna-document-analysis/luna-document-analysis-agent';
import { analyzeImage } from '../../agents/luna-image-analysis/luna-image-analysis-agent';
import { transcribeAudio } from '../../services/openai-audio';
import { logConversation } from './logger';
import type { ZendeskMessageContent } from './schema';

const VIDEO_UNSUPPORTED_MESSAGE =
  '[Cliente enviou um vídeo. Diga que ainda não conseguimos abrir vídeos e peça uma descrição em texto ou uma foto/print do problema.]';
const STICKER_UNSUPPORTED_MESSAGE = '[Cliente enviou uma figurinha ou emoji]';
const FILE_PLACEHOLDER_MESSAGE = 'usuário enviou um arquivo';

// Independente do tipo recebido, sempre resolve pro mesmo formato: um texto que a Luna
// consegue processar como se fosse a mensagem original do cliente.
export async function resolveMessageOutput(
  conversationId: string,
  messageType: string,
  content: ZendeskMessageContent,
  userMessage: string,
): Promise<string> {
  logConversation(conversationId, `analisando tipo de mensagem "${messageType}"...`);

  if (messageType === 'text') return content.text ?? '';
  if (messageType === 'videoMessage') return VIDEO_UNSUPPORTED_MESSAGE;
  if (messageType === 'stickerMessage') return STICKER_UNSUPPORTED_MESSAGE;
  if (messageType === 'image') return analyzeImage(requireMediaUrl(content), content.mediaType, userMessage);

  // Áudio do WhatsApp costuma chegar com message_type "file" e mediaType "audio/ogg" —
  // por isso é detectado pelo mediaType, não pelo message_type, e checado antes do resto de "file".
  if (content.mediaType === 'audio/ogg') return transcribeAudio(requireMediaUrl(content));
  if (messageType === 'file' && content.mediaUrl) return analyzeDocument(content.mediaUrl, content.mediaType, userMessage);

  return FILE_PLACEHOLDER_MESSAGE;
}

function requireMediaUrl(content: ZendeskMessageContent): string {
  if (!content.mediaUrl) {
    throw new Error(`Zendesk message content of type "${content.type}" is missing mediaUrl`);
  }
  return content.mediaUrl;
}
