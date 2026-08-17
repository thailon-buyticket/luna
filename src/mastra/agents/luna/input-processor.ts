import type { MastraDBMessage } from '@mastra/core/memory';
import type { Processor, ProcessInputArgs } from '@mastra/core/processors';
import { getActiveLunaIncidents } from './incidents';
import { getActiveLunaKnowledgeBases } from './knowledge-bases';
import { buildContextPrompt } from './prompts/context-prompt';
import { getActiveLunaSkills } from './skills';

export class LunaContextProcessor implements Processor {
  readonly id = 'luna-context-processor';

  async processInput({ messages }: ProcessInputArgs): Promise<MastraDBMessage[]> {
    let lastUserMessage: MastraDBMessage | undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMessage = messages[i];
        break;
      }
    }

    const parts = lastUserMessage?.content.parts;
    if (!parts) return messages;

    let userText = '';
    for (const part of parts) {
      if (part.type === 'text') {
        userText += part.text;
      }
    }
    if (!userText) return messages;

    const [skills, knowledgeBases, incidents] = await Promise.all([
      getActiveLunaSkills(),
      getActiveLunaKnowledgeBases(),
      getActiveLunaIncidents(),
    ]);
    const wrappedText = buildContextPrompt(userText, new Date(), skills, knowledgeBases, incidents);

    let replaced = false;
    lastUserMessage!.content.parts = parts.filter((part) => {
      if (part.type !== 'text') return true;
      if (replaced) return false;
      part.text = wrappedText;
      replaced = true;
      return true;
    });

    return messages;
  }
}
