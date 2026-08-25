import { Luna } from '../luna/luna';
import type { MessageExchange } from '../luna/memory/transcript';
import { logConversation } from '../../helpers/logger';
import { classifyHandoffTags } from './tags-agent';
import { classifySpecialTags } from './special-tags-agent';

function exchangesToTranscript(history: MessageExchange[]): string {
  return history.map((exchange) => `user: ${exchange.user_message}\nassistant: ${exchange.bot_answer}`).join('\n');
}

// Tags de tabulação do atendimento — os 2 agentes de `agents/tags/` (ver AGENTS.md lá): tags de
// operação (`classifyHandoffTags`, precisa do `tipo_cliente`) e tags especiais/críticas
// (`classifySpecialTags`, cross-cutting, roda mesmo sem `tipo_cliente` conhecido). Rodam em
// paralelo; o resultado é deduplicado, então tag que os dois concordarem não repete no Zendesk.
// Se não der pra achar o histórico da conversa, segue sem tag nenhuma. Usado pelo handoff do
// Zendesk (`routes/zendesk-webhook.ts`) e pelo endpoint `/luna/ask` (`routes/luna-api.ts`, onde
// as tags entram no JSON de resposta, sem gerar handoff nenhum ali).
export async function createTicketTagsWithAI(
  conversationId: string,
  resourceId: string,
  workingMemory: Awaited<ReturnType<typeof Luna.ask>>['working_memory'],
): Promise<string[]> {
  const history = await Luna.getMessageHistory(conversationId, resourceId);
  if (history.status !== 'ok') {
    logConversation(conversationId, 'histórico da conversa indisponível, sem tags de tabulação');
    return [];
  }

  const transcript = exchangesToTranscript(history.history);
  if (!transcript) {
    logConversation(conversationId, 'histórico vazio, sem tags de tabulação');
    return [];
  }

  const customerType = workingMemory?.tipo_cliente;
  logConversation(conversationId, `resolvendo tags de tabulação (tipo_cliente: ${customerType ?? 'desconhecido'})`);

  const [operacaoTags, specialTags] = await Promise.all([
    customerType ? classifyHandoffTags(transcript, customerType) : Promise.resolve([]),
    classifySpecialTags(transcript),
  ]);

  const tags = [...new Set([...operacaoTags, ...specialTags])];
  logConversation(conversationId, `tags de tabulação resolvidas: ${tags.length ? tags.join(', ') : 'nenhuma'}`);
  return tags;
}
