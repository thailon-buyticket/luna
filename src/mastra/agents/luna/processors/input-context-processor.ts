import type { Processor, ProcessLLMRequestArgs, ProcessLLMRequestResult } from '@mastra/core/processors';
import { getHiveOps } from '../../../hiveops';
import { buildContextPrompt } from '../prompts/context-prompt';

// Roda em processLLMRequest (não processInput) de propósito: o embrulho de contexto
// (habilidades/bases de conhecimento/incidências) fica só no prompt enviado ao model
// desta chamada. Nada disso é persistido no MessageList/memória — quem ler o histórico
// depois (working memory, tipo de cliente, guardrail, /luna/history) já recebe a
// mensagem do cliente limpa, sem precisar desembrulhar nada.
export class LunaContextProcessor implements Processor {
  readonly id = 'luna-context-processor';

  async processLLMRequest({ prompt, state }: ProcessLLMRequestArgs): Promise<ProcessLLMRequestResult> {
    const lastUserMessage = [...prompt].reverse().find((message) => message.role === 'user');
    const textPart = lastUserMessage?.content.find((part) => part.type === 'text');
    if (!textPart?.text) return;

    if (state.wrappedText === undefined) {
      const hiveOps = getHiveOps();
      const [skills, knowledgeBases, incidents] = await Promise.all([
        hiveOps.getActiveSkills(),
        hiveOps.getActiveKnowledgeBases(),
        hiveOps.getActiveIncidents(),
      ]);
      state.wrappedText = buildContextPrompt(textPart.text, new Date(), skills, knowledgeBases, incidents);
    }

    textPart.text = state.wrappedText as string;
    return { prompt };
  }
}
