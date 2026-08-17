import { RequestContext } from '@mastra/core/request-context';
import { luna } from '../../agents/luna/luna';
import type { GuardrailOutput } from '../../agents/luna-guardrail/schema';
import { logConversation } from './logger';
import { handoffChatToHumanZendeskSwitchboard, sendMessageToUserZendesk } from './reply';

type GuardrailAction = GuardrailOutput['action'];
type LunaGenerateResult = Awaited<ReturnType<typeof luna.generate>>;

export async function processBufferedMessage(
  appId: string,
  conversationId: string,
  resourceId: string,
  phone: string | null,
  combinedText: string,
): Promise<void> {
  logConversation(conversationId, 'buffer estourou, Luna está gerando a resposta...');

  const result = await luna.generate(combinedText, {
    memory: { thread: conversationId, resource: resourceId },
    requestContext: new RequestContext(phone ? [['user_phone', phone]] : []),
  });

  const action = extractGuardrailAction(result);
  const answer = result.text?.trim();
  logConversation(conversationId, `resposta recebida da Luna (guardrail: ${action}): ${answer}`);

  // Em reply_and_connect_human, a ordem importa: primeiro a resposta chega pro cliente,
  // só depois a conversa é transferida pro humano.
  if (shouldReply(action) && answer) {
    await sendMessageToUserZendesk(appId, conversationId, answer);
  }

  if (shouldConnectHuman(action)) {
    await handoffChatToHumanZendeskSwitchboard(appId, conversationId);
  }
}

function extractGuardrailAction(result: LunaGenerateResult): GuardrailAction {
  const assistantMessage = result.response?.uiMessages?.find((message) => message.role === 'assistant');
  const guardrail = (assistantMessage?.metadata as { guardrail?: GuardrailOutput } | undefined)?.guardrail;
  return guardrail?.action ?? 'reply';
}

function shouldReply(action: GuardrailAction): boolean {
  return action === 'reply' || action === 'reply_and_connect_human';
}

function shouldConnectHuman(action: GuardrailAction): boolean {
  return action === 'connect_human' || action === 'reply_and_connect_human';
}
