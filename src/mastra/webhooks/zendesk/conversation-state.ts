import { env } from '../../config/env';
import { requireEnv } from '../../config/require-env';
import { getSupabaseClient } from '../../services/supabase';

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
  const { LUNA_TENANT_ID } = requireEnv({ LUNA_TENANT_ID: env.LUNA_TENANT_ID }, 'Zendesk conversation state');

  const { data, error } = await getSupabaseClient()
    .from('conversations')
    .select('id')
    .eq('tenant_id', LUNA_TENANT_ID)
    .eq('external_id', conversationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load conversation state: ${error.message}`);
  }

  return {
    isNewConversation: !data,
    resourceId: phone ?? `zendesk:${userId ?? conversationId}`,
  };
}
