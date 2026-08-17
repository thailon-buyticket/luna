import { env } from '../../config/env';
import { requireEnv } from '../../config/require-env';
import { getSupabaseClient } from '../../services/supabase';

export interface LunaSkill {
  slug: string;
  intent: string;
}

export async function getActiveLunaSkills(): Promise<LunaSkill[]> {
  const { LUNA_TENANT_ID } = requireEnv({ LUNA_TENANT_ID: env.LUNA_TENANT_ID }, 'Luna skills (playbooks)');

  const { data, error } = await getSupabaseClient()
    .from('playbooks')
    .select('slug, intent')
    .eq('active', true)
    .eq('tenant_id', LUNA_TENANT_ID);

  if (error) {
    throw new Error(`Failed to load Luna skills from Supabase: ${error.message}`);
  }

  return data ?? [];
}

export interface LunaSkillDetail {
  name: string;
  intent: string;
  slots: unknown;
  rules: unknown;
  fallback: unknown;
  notes: string | null;
}

export async function getLunaSkillBySlug(slug: string): Promise<LunaSkillDetail | null> {
  const { LUNA_TENANT_ID } = requireEnv({ LUNA_TENANT_ID: env.LUNA_TENANT_ID }, 'Luna skills (playbooks)');

  const { data, error } = await getSupabaseClient()
    .from('playbooks')
    .select('name, intent, slots, rules, fallback, notes')
    .eq('active', true)
    .eq('tenant_id', LUNA_TENANT_ID)
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Luna skill "${slug}" from Supabase: ${error.message}`);
  }

  return data;
}
