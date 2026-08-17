import { resolveMessageOutput } from './attachment-router';
import { isContactBlocked } from './blocklist';
import { getConversationState } from './conversation-state';
import { logConversation, logConversationError } from './logger';
import { cancelBuffer, pushMessage } from './message-buffer';
import { normalizeIncomingMessage, type NormalizedZendeskMessage } from './normalize';
import { processBufferedMessage } from './pipeline';
import { handoffChatToHumanZendeskSwitchboard } from './reply';
import type { ZendeskConversationMessagePayload, ZendeskMessageContent } from './schema';

const LUNA_DISPLAY_NAME_MARKER = 'Luna';

// Entrypoint chamado pela rota do webhook sem `await` — a resposta pro Zendesk precisa ser
// imediata, então esta função nunca deixa um erro escapar: qualquer falha no processamento
// (Supabase, Zendesk, Luna) é capturada e só logada aqui.
export async function handleConversationMessage(appId: string, payload: ZendeskConversationMessagePayload): Promise<void> {
  const normalized = normalizeIncomingMessage(appId, payload);
  const origin = normalized.isFromCompany ? 'empresa' : 'cliente';
  logConversation(normalized.conversationId, `mensagem recebida (tipo: ${normalized.messageType}, origem: ${origin})`);

  try {
    if (normalized.isFromCompany) {
      await handleCompanyMessage(normalized);
      return;
    }

    await handleCustomerMessage(normalized, payload.message.content);
  } catch (error) {
    logConversationError(normalized.conversationId, 'failed to handle incoming message', error);
  }
}

// Mensagem da própria Luna ecoando pelo webhook: nada a fazer. Mensagem de um humano
// respondendo por fora da Luna: cancela qualquer resposta ainda em buffer e devolve o
// controle da conversa pro time humano.
async function handleCompanyMessage({ appId, conversationId, userName }: NormalizedZendeskMessage): Promise<void> {
  if (userName?.includes(LUNA_DISPLAY_NAME_MARKER)) return;

  cancelBuffer(conversationId);
  await handoffChatToHumanZendeskSwitchboard(appId, conversationId);
}

async function handleCustomerMessage(normalized: NormalizedZendeskMessage, content: ZendeskMessageContent): Promise<void> {
  const { appId, conversationId, userPhone, externalId, userId, messageType, userMessage } = normalized;

  // Bloqueio (Zendesk) e estado da conversa (Supabase) não dependem um do outro — resolvidos
  // em paralelo pra não somar as duas latências de rede no caminho comum (contato liberado).
  const [blocked, state] = await Promise.all([
    isContactBlocked(userPhone, externalId),
    getConversationState(conversationId, userPhone, userId),
  ]);

  if (blocked) {
    // Contato com alguma tag de handoff no Zendesk: a Luna não cuida desses casos.
    await handoffChatToHumanZendeskSwitchboard(appId, conversationId);
    return;
  }

  // Não espera a análise terminar pra entrar no buffer: ela roda em paralelo com o timer do
  // buffer, que só usa o resultado quando for de fato liberar a mensagem pra Luna.
  const outputPromise = resolveMessageOutput(conversationId, messageType, content, userMessage);
  logConversation(conversationId, 'mensagem enviada pro buffer (análise em andamento)');

  pushMessage(conversationId, outputPromise, (combinedText) =>
    processBufferedMessage(appId, conversationId, state.resourceId, userPhone, combinedText),
  );
}
