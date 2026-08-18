import { getHiveOps } from '../../hiveops';
import { zendeskRequest } from '../../services/zendesk';
import { normalizeMessageInput } from '../../workflows/message-normalizer';
import { logConversation } from '../../helpers/logger'
import { resolveBusinessByAppId } from '../../business/registry';
import type { ConversationState, PreparedZendeskMessage, ZendeskConversationMessagePayload, ZendeskUserSearchResponse } from './schema';
import { normalizeIncomingMessage } from './zendesk-client';

const LUNA_DISPLAY_NAME_MARKER = 'Luna';

// Tudo que precisa acontecer ANTES de chamar o workflow `ask-luna`: identificar se a mensagem
// é da empresa ou do cliente, checar bloqueio e o estado da conversa, e resolver o conteúdo de
// mídia. O workflow em si fica simples — só recebe a mensagem já pronta pra ir pra Luna.
export async function onMessageReceived(
  appId: string,
  payload: ZendeskConversationMessagePayload,
): Promise<PreparedZendeskMessage> {
  const normalized = normalizeIncomingMessage(appId, payload);
  const origin = normalized.isFromCompany ? 'empresa' : 'cliente';
  logConversation(normalized.conversationId, `mensagem recebida (tipo: ${normalized.messageType}, origem: ${origin})`);

  const business = resolveBusinessByAppId(appId);

  if (normalized.isFromCompany) {
    // Mensagem da própria Luna ecoando pelo webhook: nada a fazer. Mensagem de um humano
    // respondendo por fora da Luna: devolve o controle da conversa pro time humano.
    if (!normalized.userName?.includes(LUNA_DISPLAY_NAME_MARKER)) {
      await business.handoffToHuman(normalized.conversationId);
    }
    return { shouldAskLuna: false };
  }

  const [blocked, state] = await Promise.all([
    isContactBlocked(normalized.userPhone, normalized.externalId),
    getConversationState(normalized.conversationId, normalized.userPhone, normalized.userId),
  ]);

  if (blocked) {
    // Contato com alguma tag de handoff no Zendesk: a Luna não cuida desses casos.
    await business.handoffToHuman(normalized.conversationId);
    return { shouldAskLuna: false };
  }

  const message = await normalizeMessageInput(
    normalized.conversationId,
    normalized.messageType,
    payload.message.content,
    normalized.userMessage,
  );

  return {
    shouldAskLuna: true,
    input: {
      appId,
      conversationId: normalized.conversationId,
      resourceId: state.resourceId,
      userPhone: normalized.userPhone,
      message,
    },
  };
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