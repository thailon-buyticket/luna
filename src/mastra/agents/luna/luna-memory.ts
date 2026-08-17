import { Memory } from '@mastra/memory';
import { lunaWorkingMemorySchema } from '../luna-working-memory/schema';
import { conversationMemoryExtractor } from './memory/conversation-memory-extractor';

export const lunaMemory = new Memory({
  options: {
    generateTitle: true,
    observationalMemory: {
      model: 'openai/gpt-5.6-terra',
      observation: {
        extract: [conversationMemoryExtractor],
      },
    },
    workingMemory: {
      enabled: true,
      scope: 'resource',
      schema: lunaWorkingMemorySchema,
      agentManaged: false,
    },
  },
});
