import { getHiveOps } from '../../hiveops';

export interface ConversationState {
  isNewConversation: boolean;
  resourceId: string;
}

// Verifica a existência da conversa na tabela `conversations` (HiveOps), pelo external_id
// (o conversation_id do Zendesk). A tabela `conversation_memory` é outra coisa: memória
// interna da Luna, atualizada sozinha via conversationMemoryExtractor
// (agents/luna/memory/conversation-memory-extractor.ts).
export async function getConversationState(
  conversationId: string,
  phone: string | null,
  userId: string | undefined,
): Promise<ConversationState> {
  const conversation = await getHiveOps().findConversationByExternalId(conversationId);

  return {
    isNewConversation: !conversation,
    resourceId: phone ?? `zendesk:${userId ?? conversationId}`,
  };
}
