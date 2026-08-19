import { analyzeDocument } from '../../agents/luna-document-analysis/luna-document-analysis-agent';
import { analyzeImage } from '../../agents/luna-image-analysis/luna-image-analysis-agent';
import { transcribeAudio } from '../../services/openai-audio';
import { PREDEFINED_MESSAGES } from '../../predefined-messages';
import type { MediaType } from './zendesk';

export interface transformMessageInTextWithAIInput {
  mediaType: MediaType;
  mediaUrl: string | undefined;
  additionalText: string;
}

// Independente do tipo recebido, sempre resolve pro mesmo formato: um texto que a Luna
// consegue processar como se fosse a mensagem original do cliente.
export async function transformMessageInTextWithAI({ mediaType, mediaUrl, additionalText }: transformMessageInTextWithAIInput): Promise<string> {
  switch (mediaType) {
    case 'text':
      return additionalText;
    case 'video':
      return PREDEFINED_MESSAGES.media.video_unsupported;
    case 'sticker':
      return PREDEFINED_MESSAGES.media.sticker_unsupported;
    case 'image':
      return analyzeImage(requireMediaUrl(mediaUrl), undefined, additionalText);
    case 'audio':
      return transcribeAudio(requireMediaUrl(mediaUrl));
    case 'file':
      return mediaUrl ? analyzeDocument(mediaUrl, undefined, additionalText) : PREDEFINED_MESSAGES.media.file_placeholder;
  }
}

function requireMediaUrl(mediaUrl: string | undefined): string {
  if (!mediaUrl) {
    throw new Error('Zendesk media message is missing mediaUrl');
  }
  return mediaUrl;
}
