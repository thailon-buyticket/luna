import { env } from '../../../config/env';
import { requireEnv } from '../../../config/require-env';
import { getSupabaseClient } from '../../../services/supabase';
import type { ConversationMemory } from './conversation-memory-schema';
import type { CustomerTypeCategory } from '../../luna-customer-type/schema';

interface UpsertConversationMemoryInput extends Partial<ConversationMemory> {
  conversationId: string;
  resourceId?: string;
  customer_type?: CustomerTypeCategory;
}

export async function upsertConversationMemory({
  conversationId,
  resourceId,
  ...fields
}: UpsertConversationMemoryInput): Promise<void> {
  const { LUNA_TENANT_ID } = requireEnv({ LUNA_TENANT_ID: env.LUNA_TENANT_ID }, 'Luna conversation memory');

  const { error } = await getSupabaseClient()
    .from('conversation_memory')
    .upsert(
      {
        tenant_id: LUNA_TENANT_ID,
        conversation_id: conversationId,
        resource_id: resourceId ?? null,
        ...fields,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'conversation_id' },
    );

  if (error) {
    throw new Error(`Failed to upsert conversation memory: ${error.message}`);
  }
}
