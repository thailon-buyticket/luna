import { Extractor } from '@mastra/memory';
import { getHiveOps } from '../../../hiveops';
import { conversationMemorySchema } from './conversation-memory-schema';
import { classifyCustomerType } from '../../luna-customer-type/luna-customer-type-agent';
import { messagesToTranscript } from './transcript';

export const conversationMemoryExtractor = new Extractor({
  name: 'Conversation memory',
  instructions: `Extraia o seguinte sobre esta conversa:
- problem_summary: uma frase objetiva do problema que o cliente quer resolver nesta conversa.
- data_needed: lista dos dados que ainda faltam ser coletados para resolver o problema (ex.: ["ID do pedido", "motivo do cancelamento"]).
- data_collected: dados que o cliente já informou nesta conversa, como pares chave-valor.

Só preencha um campo quando houver evidência clara na conversa. Nunca invente informação. Mantenha valores já extraídos anteriormente quando ainda forem válidos.`,
  schema: conversationMemorySchema,
  onExtracted: async ({ current, threadId, resourceId, memory }) => {
    let customerType: Awaited<ReturnType<typeof classifyCustomerType>> | undefined;

    if (memory) {
      const { messages } = await memory.getContext({ threadId, resourceId });
      const transcript = messagesToTranscript(messages);
      if (transcript) {
        customerType = await classifyCustomerType(transcript);
      }
    }

    await getHiveOps().upsertConversationMemory({
      conversationId: threadId,
      resourceId,
      customer_type: customerType,
      ...current,
    });
    return current;
  },
});
