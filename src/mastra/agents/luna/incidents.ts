import { env } from '../../config/env';
import { requireEnv } from '../../config/require-env';
import { getSupabaseClient } from '../../services/supabase';

export interface LunaIncident {
  title: string;
  content: string;
}

export async function getActiveLunaIncidents(): Promise<LunaIncident[]> {
  const { LUNA_TENANT_ID } = requireEnv({ LUNA_TENANT_ID: env.LUNA_TENANT_ID }, 'Luna incidents');

  const { data, error } = await getSupabaseClient()
    .from('incidents')
    .select('title, content')
    .eq('active', true)
    .eq('tenant_id', LUNA_TENANT_ID);

  if (error) {
    throw new Error(`Failed to load Luna incidents from Supabase: ${error.message}`);
  }

  return data ?? [];
}
