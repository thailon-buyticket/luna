import { getHiveOps } from '../../hiveops';
import { zendeskRequest } from '../../services/zendesk';

interface ZendeskUser {
  phone?: string;
}

interface ZendeskUserSearchResponse {
  users: ZendeskUser[];
}

// Um contato é considerado bloqueado quando existe um usuário no Zendesk com o telefone dele
// que também carrega alguma tag de handoff (ex.: "golpe", "vip-humano" etc, configuráveis via
// HiveOps). A busca cobre telefone com e sem "+" e o `externalId` do webhook como variantes,
// já que o mesmo contato pode aparecer cadastrado em formatos diferentes no Zendesk.
export async function isContactBlocked(phone: string | null, externalId: string | undefined): Promise<boolean> {
  const handoffTags = await getHiveOps().getHandoffTagTitles();

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
