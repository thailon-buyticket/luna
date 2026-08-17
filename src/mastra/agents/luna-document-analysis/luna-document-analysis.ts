import { Agent } from '@mastra/core/agent';
import { buildDocumentAnalysisPrompt } from './prompts/system-prompt';

export const documentAnalysisAgent = new Agent({
  id: 'luna-document-analysis',
  name: 'Luna Document Analysis',
  description: 'Descreve documentos/arquivos enviados pelo cliente para servir de input pra Luna.',
  instructions: buildDocumentAnalysisPrompt(),
  model: 'openai/gpt-4.1-mini',
});

export async function analyzeDocument(mediaUrl: string, mediaType: string | undefined, userMessage: string): Promise<string> {
  const { text } = await documentAnalysisAgent.generate([
    {
      role: 'user',
      content: [
        { type: 'file', data: mediaUrl, mimeType: mediaType ?? 'application/pdf' },
        { type: 'text', text: `Mensagem do usuário: ${userMessage || 'nada'}` },
      ],
    },
  ]);

  return text;
}
