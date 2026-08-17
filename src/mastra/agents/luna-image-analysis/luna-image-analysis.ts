import { Agent } from '@mastra/core/agent';
import { buildImageAnalysisPrompt } from './prompts/system-prompt';

export const imageAnalysisAgent = new Agent({
  id: 'luna-image-analysis',
  name: 'Luna Image Analysis',
  description: 'Descreve imagens enviadas pelo cliente para servir de input pra Luna.',
  instructions: buildImageAnalysisPrompt(),
  model: 'openai/gpt-4.1-mini',
});

export async function analyzeImage(mediaUrl: string, mediaType: string | undefined, userMessage: string): Promise<string> {
  const { text } = await imageAnalysisAgent.generate([
    {
      role: 'user',
      content: [
        { type: 'image', image: mediaUrl, mimeType: mediaType ?? 'image/jpeg' },
        { type: 'text', text: `Mensagem do usuário: ${userMessage || 'nada'}` },
      ],
    },
  ]);

  return text;
}
