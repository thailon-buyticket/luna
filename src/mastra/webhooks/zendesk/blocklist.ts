import { env } from '../../config/env';
import { requireEnv } from '../../config/require-env';
import { getSupabaseClient } from '../../services/supabase';
import { zendeskRequest } from '../../services/zendesk';

interface ZendeskUser {
  phone?: string;
}

interface ZendeskUserSearchResponse {
  users: ZendeskUser[];
}

async function getHandoffTagTitles(): Promise<string[]> {
  const { LUNA_TENANT_ID } = requireEnv({ LUNA_TENANT_ID: env.LUNA_TENANT_ID }, 'Zendesk blocklist check');

  const { data, error } = await getSupabaseClient()
    .from('tags')
    .select('title')
    .eq('active', true)
    .eq('type', 'handoff')
    .eq('tenant_id', LUNA_TENANT_ID);

  if (error) {
    throw new Error(`Failed to load handoff tags: ${error.message}`);
  }

  return (data ?? []).map((tag) => tag.title as string);
}

// Um contato é considerado bloqueado quando existe um usuário no Zendesk com o telefone dele
// que também carrega alguma tag de handoff (ex.: "golpe", "vip-humano" etc, configuráveis via
// Supabase). A busca cobre telefone com e sem "+" e o `externalId` do webhook como variantes,
// já que o mesmo contato pode aparecer cadastrado em formatos diferentes no Zendesk.
export async function isContactBlocked(phone: string | null, externalId: string | undefined): Promise<boolean> {
  const handoffTags = await getHandoffTagTitles();

  const query = [
    'type:user',
    `phone:${phone ?? ''}`,
    `phone:+${phone ?? ''}`,
    `phone:${externalId ?? ''}`,
    `phone:+${externalId ?? ''}`,
    ...handoffTags.map((title) => `tags:${title}`),
  ].join('\n');

  const response = await zendeskRequest<ZendeskUserSearchResponse>(`users/search.json?query=${encodeURIComponent(query)}`);

  return response.users.some((user) => Boolean(user.phone));
}
