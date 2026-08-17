import { env } from '../../config/env';
import { requireEnv } from '../../config/require-env';
import { getSupabaseClient } from '../../services/supabase';

export interface LunaKnowledgeBase {
  slug: string;
  description: string;
}

export async function getActiveLunaKnowledgeBases(): Promise<LunaKnowledgeBase[]> {
  const { LUNA_TENANT_ID } = requireEnv({ LUNA_TENANT_ID: env.LUNA_TENANT_ID }, 'Luna knowledge bases');

  const { data, error } = await getSupabaseClient()
    .from('knowledge_bases')
    .select('slug, description')
    .eq('active', true)
    .eq('is_available_for_bots', true)
    .eq('tenant_id', LUNA_TENANT_ID);

  if (error) {
    throw new Error(`Failed to load Luna knowledge bases from Supabase: ${error.message}`);
  }

  return data ?? [];
}
