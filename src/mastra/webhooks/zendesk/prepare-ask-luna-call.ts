import { resolveMessageOutput } from './attachment-router';
import { isContactBlocked } from './blocklist';
import { getConversationState } from './conversation-state';
import { logConversation } from './logger';
import { normalizeIncomingMessage } from './normalize';
import { handoffChatToHumanZendeskSwitchboard } from './reply';
import type { ZendeskConversationMessagePayload } from './schema';

export interface AskLunaInput {
  appId: string;
  conversationId: string;
  resourceId: string;
  userPhone: string | null;
  message: string;
}

export type PreparedZendeskMessage = { shouldAskLuna: false } | { shouldAskLuna: true; input: AskLunaInput };

const LUNA_DISPLAY_NAME_MARKER = 'Luna';

// Tudo que precisa acontecer ANTES de chamar o workflow `ask-luna`: identificar se a mensagem
// é da empresa ou do cliente, checar bloqueio e o estado da conversa, e resolver o conteúdo de
// mídia. O workflow em si fica simples — só recebe a mensagem já pronta pra ir pra Luna.
export async function prepareZendeskMessage(
  appId: string,
  payload: ZendeskConversationMessagePayload,
): Promise<PreparedZendeskMessage> {
  const normalized = normalizeIncomingMessage(appId, payload);
  const origin = normalized.isFromCompany ? 'empresa' : 'cliente';
  logConversation(normalized.conversationId, `mensagem recebida (tipo: ${normalized.messageType}, origem: ${origin})`);

  const ticket = { appId, conversationId: normalized.conversationId };

  if (normalized.isFromCompany) {
    // Mensagem da própria Luna ecoando pelo webhook: nada a fazer. Mensagem de um humano
    // respondendo por fora da Luna: devolve o controle da conversa pro time humano.
    if (!normalized.userName?.includes(LUNA_DISPLAY_NAME_MARKER)) {
      await handoffChatToHumanZendeskSwitchboard(ticket);
    }
    return { shouldAskLuna: false };
  }

  const [blocked, state] = await Promise.all([
    isContactBlocked(normalized.userPhone, normalized.externalId),
    getConversationState(normalized.conversationId, normalized.userPhone, normalized.userId),
  ]);

  if (blocked) {
    // Contato com alguma tag de handoff no Zendesk: a Luna não cuida desses casos.
    await handoffChatToHumanZendeskSwitchboard(ticket);
    return { shouldAskLuna: false };
  }

  const message = await resolveMessageOutput(
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
