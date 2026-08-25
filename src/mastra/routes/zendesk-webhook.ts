import { registerApiRoute } from '@mastra/core/server';
import { Luna } from '../agents/luna/luna';
import type { MessageExchange } from '../agents/luna/memory/transcript';
import { classifyHandoffTags } from '../agents/tags/tags-agent';
import { classifySpecialTags } from '../agents/tags/special-tags-agent';
import { resolveBusinessByAppId } from '../business/registry';
import { env } from '../config/env';
import { requireEnv } from '../config/require-env';
import { logConversation, logConversationError, logWarning } from '../helpers/logger';
import { zendeskRequest } from '../services/zendesk';
import { getHiveOps } from '../hiveops';
import { conversationMessageSchema, zendeskWebhookSchema } from '../webhooks/zendesk';
import type { AskLunaInput } from '../webhooks/zendesk/schema';
import { buildHandoffTags } from '../webhooks/zendesk/handoff-tags';
import { bufferMessage } from '../webhooks/zendesk/message-buffer';
import { buildHandoffTicketFields } from '../webhooks/zendesk/ticket-fields';
import { transformMessageInTextWithAI } from '../webhooks/zendesk/message-normalizer';
import type { ZendeskConversationMessagePayload, ZendeskUserSearchResponse } from '../webhooks/zendesk/schema';
import { normalizeIncomingMessage, zendesk } from '../webhooks/zendesk/zendesk';
import { parseOrBadRequest } from './validate';
import { PREDEFINED_MESSAGES } from '../predefined-messages';

// Ponto de entrada único pro fluxo "mensagem nova do Zendesk chegou": recebe o webhook, prepara
// a mensagem (bloqueio, mídia normalizada pra texto), junta com outras mensagens próximas no
// tempo da mesma conversa (buffer) e manda pra Luna, aplicando a decisão do guardrail.
export const zendeskWebhookRoute = registerApiRoute('/webhooks/zendesk', {
  method: 'POST',
  // O Zendesk chama esse endpoint sem o header Authorization da nossa API — precisa ficar
  // fora da autenticação (SimpleAuth) configurada no server.
  requiresAuth: false,
  openapi: {
    summary: 'Recebe eventos de conversa do Zendesk (WhatsApp)',
    description:
      'Webhook chamado pelo Zendesk a cada mensagem de uma conversa. A resposta ao Zendesk é sempre ' +
      'imediata — todo o processamento roda em background: identifica bloqueio, normaliza mídia (áudio, ' +
      'imagem, etc.) pra texto, junta com outras mensagens próximas no tempo da mesma conversa (buffer) ' +
      'e só então manda pra Luna, aplicando a decisão do guardrail (responder e/ou transferir para um humano).',
    tags: ['Zendesk'],
  },
  handler: async (c) => {
    const { ZENDESK_WEBHOOK_ID, ZENDESK_WEBHOOK_SECRET } = requireEnv(
      { ZENDESK_WEBHOOK_ID: env.ZENDESK_WEBHOOK_ID, ZENDESK_WEBHOOK_SECRET: env.ZENDESK_WEBHOOK_SECRET },
      'Zendesk webhook',
    );

    if (c.req.header('x-api-key') !== ZENDESK_WEBHOOK_SECRET) {
      return c.json({ error: 'unauthorized' }, 401);
    }

    const parsed = parseOrBadRequest(zendeskWebhookSchema, await c.req.json(), c);
    if (parsed instanceof Response) return parsed;

    if (parsed.webhook.id !== ZENDESK_WEBHOOK_ID) {
      return c.json({ error: 'unauthorized' }, 401);
    }

    for (const event of parsed.events) {
      const message = conversationMessageSchema.safeParse(event.payload);
      if (!message.success) {
        logWarning(`evento zendesk inválido (app ${parsed.app.id})`, message.error.flatten());
        continue;
      }

      void onNewZendeskMessageReceived(parsed.app.id, message.data).catch((error) =>
        logConversationError(message.data.conversation.id, 'falha ao processar mensagem recebida', error),
      );
    }

    return c.json({ received: true });
  },
});

// Conversas com um buffer aberto (aguardando mensagens novas antes de perguntar pra Luna),
// usado só pra saber se uma mensagem que chega fecha um buffer anterior ou abre um novo.
const conversationsAwaitingBuffer = new Set<string>();

// Nunca espera esse processamento terminar antes de responder ao Zendesk. Identifica se a
// mensagem é da empresa ou do cliente, checa bloqueio, normaliza mídia pra texto e só então
// junta com outras mensagens próximas no tempo da mesma conversa (buffer) antes de perguntar
// pra Luna.
async function onNewZendeskMessageReceived(appId: string, payload: ZendeskConversationMessagePayload): Promise<void> {
  const zendeskPayload = normalizeIncomingMessage(appId, payload);
  logConversation(
    zendeskPayload.conversationId,
    `mensagem recebida de "${zendeskPayload.userName ?? 'desconhecido'}" (${zendeskPayload.mediaType}, origem: ${zendeskPayload.isFromCompany ? 'empresa' : 'cliente'})`,
  );

  if (zendeskPayload.isFromCompany) {
    if (zendeskPayload.userName?.includes(Luna.id)) {
      // logConversation(zendeskPayload.conversationId, "echo do Zendesk - mensagem da própria luna: não tratar" )
      return;
    }
    logConversation(zendeskPayload.conversationId, "empresa mandou mensagem na conversa" )
    zendesk
      .connectHuman(appId, zendeskPayload.conversationId, {
        tags: buildHandoffTags('luna-interrompida', null),
        ticketFields: buildHandoffTicketFields(zendeskPayload.conversationId, null),
      })
      .then(() => logConversation(zendeskPayload.conversationId, "luna desativada da conversa" ));
    return;
  }

  // Contato com alguma tag de handoff no Zendesk, ou mensagem com palavra-chave de bypass:
  // a Luna não cuida desses casos.
  const bypassKeyword = isMessageKeywordToBypassAgent(zendeskPayload.additionalText);
  if ((await isContactBlocked(zendeskPayload.conversationId, zendeskPayload.userPhone, zendeskPayload.externalId)) || bypassKeyword) {
    logConversation(
      zendeskPayload.conversationId,
      bypassKeyword ? 'mensagem com palavra-chave de bypass' : 'usuário bloqueado ou com tags de bloqueio',
    )
    zendesk
      .connectHuman(appId, zendeskPayload.conversationId, {
        tags: buildHandoffTags('luna-interrompida', null),
        ticketFields: buildHandoffTicketFields(zendeskPayload.conversationId, null),
      })
      .then(() => logConversation(zendeskPayload.conversationId, "luna desativada da conversa" ));
    return;
  }

  if (zendeskPayload.mediaType === 'sticker') {
    logConversation(zendeskPayload.conversationId, 'sticker recebido e ignorado');
    return;
  }

  logConversation(zendeskPayload.conversationId, `transformando mensagem "${zendeskPayload.mediaType}"`);
  const message = await transformMessageInTextWithAI({
    mediaType: zendeskPayload.mediaType,
    mediaUrl: zendeskPayload.mediaUrl,
    additionalText: zendeskPayload.additionalText,
  });
  const resourceId = zendeskPayload.userPhone ?? `zendesk:${zendeskPayload.userId ?? zendeskPayload.conversationId}`;

  if (conversationsAwaitingBuffer.has(zendeskPayload.conversationId)) {
    logConversation(zendeskPayload.conversationId, 'Nova mensagem chegou, fluxo encerrado');
  }
  conversationsAwaitingBuffer.add(zendeskPayload.conversationId);
  logConversation(zendeskPayload.conversationId, 'Aguardando novas mensagens');

  bufferMessage({ appId, conversationId: zendeskPayload.conversationId, resourceId, userPhone: zendeskPayload.userPhone, message }, async (merged) => {
    conversationsAwaitingBuffer.delete(merged.conversationId);
    logConversation(merged.conversationId, 'Nenhuma nova mensagem, gerar resposta');
    logConversation(merged.conversationId, `buffer fechado, perguntando pra Luna: "${merged.message}"`);

    const askResult = await askLunaWithFallback(merged);
    if (!askResult) {
      // Luna esgotou as tentativas e não conseguiu gerar nenhuma resposta — o cliente não pode
      // ficar sem resposta, então avisamos e passamos pra um humano em vez de deixar a conversa muda.
      
      //O codigo esta comentado pq temos um outro fluxo de retry que roda no n7n. Pega as pessoas sem respostas e reenvia pra Luan
      // const fallbackNotice = `${PREDEFINED_MESSAGES.error.technical_issue} ${PREDEFINED_MESSAGES.business.high_volume}`;
      // await zendesk.sendMessage(merged.appId, merged.conversationId, fallbackNotice);
      // await zendesk.connectHuman(merged.appId, merged.conversationId, {
      //   tags: buildHandoffTags('luna-erro', null),
      //   ticketFields: buildHandoffTicketFields(merged.conversationId, null),
      // });
      return;
    }

    const { answer, guardrail, working_memory } = askResult;
    const action = guardrail?.action ?? 'reply';
    logConversation(merged.conversationId, `Luna decidiu responder: "${answer}"`);

    if ((action === 'reply' || action === 'reply_and_connect_human') && answer) {
      await zendesk.sendMessage(merged.appId, merged.conversationId, answer);
    }

    if (action === 'connect_human' || action === 'reply_and_connect_human') {
      const notice = resolveBusinessByAppId(merged.appId).getHandoffNoticeMessage();
      if (notice) await zendesk.sendMessage(merged.appId, merged.conversationId, notice);

      const tabulacaoTags = await resolveTabulacaoTags(merged.conversationId, merged.resourceId, working_memory);
      await zendesk.connectHuman(merged.appId, merged.conversationId, {
        tags: buildHandoffTags(action, working_memory, tabulacaoTags),
        ticketFields: buildHandoffTicketFields(merged.conversationId, working_memory),
      });
    }
  });
}

const DEFAULT_ASK_MAX_ATTEMPTS = 3;

// Chama a Luna e tenta de novo se der erro (a LLM upstream falha de vez em quando por motivos
// transitórios — rate limit, timeout, item de conversa expirado). Número de tentativas
// configurável via `LUNA_ASK_MAX_ATTEMPTS` (padrão 3). Só devolve `null` — sinal pra quem chamou
// mandar a mensagem de transferência — depois de esgotar todas as tentativas sem conseguir
// nenhuma resposta.
async function askLunaWithFallback(merged: AskLunaInput): Promise<Awaited<ReturnType<typeof Luna.ask>> | null> {
  const memory = { thread: merged.conversationId, resource: merged.resourceId };
  const requestContext = merged.userPhone ? { user_phone: merged.userPhone } : {};
  const maxAttempts = env.LUNA_ASK_MAX_ATTEMPTS ?? DEFAULT_ASK_MAX_ATTEMPTS;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await Luna.ask(merged.message, { memory, requestContext });
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;
      logConversationError(
        merged.conversationId,
        isLastAttempt
          ? `Luna falhou ao gerar resposta (tentativa ${attempt}/${maxAttempts}), desistindo`
          : `Luna falhou ao gerar resposta (tentativa ${attempt}/${maxAttempts}), tentando de novo`,
        error,
      );
    }
  }

  return null;
}

function exchangesToTranscript(history: MessageExchange[]): string {
  return history.map((exchange) => `user: ${exchange.user_message}\nassistant: ${exchange.bot_answer}`).join('\n');
}

// Tags de tabulação do atendimento — os 2 agentes de `agents/tags/` (ver AGENTS.md lá): tags de
// operação (`classifyHandoffTags`, precisa do `tipo_cliente`) e tags especiais/críticas
// (`classifySpecialTags`, cross-cutting, roda mesmo sem `tipo_cliente` conhecido). Rodam em
// paralelo; o resultado é deduplicado, então tag que os dois concordarem não repete no Zendesk.
// Se não der pra achar o histórico da conversa, o handoff segue sem tag nenhuma.
async function resolveTabulacaoTags(
  conversationId: string,
  resourceId: string,
  workingMemory: Awaited<ReturnType<typeof Luna.ask>>['working_memory'],
): Promise<string[]> {
  const history = await Luna.getMessageHistory(conversationId, resourceId);
  if (history.status !== 'ok') {
    logConversation(conversationId, 'histórico da conversa indisponível, handoff sem tags de tabulação');
    return [];
  }

  const transcript = exchangesToTranscript(history.history);
  if (!transcript) {
    logConversation(conversationId, 'histórico vazio, handoff sem tags de tabulação');
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

// Um contato é considerado bloqueado quando existe um usuário no Zendesk com o telefone dele
// que também carrega alguma tag de handoff (ex.: "golpe", "vip-humano" etc, configuráveis via
// HiveOps). A busca cobre telefone com e sem "+" e o `externalId` do webhook como variantes,
// já que o mesmo contato pode aparecer cadastrado em formatos diferentes no Zendesk. Se a
// checagem falhar (Zendesk/HiveOps fora do ar), segue o fluxo assumindo que o contato não está
// bloqueado — a Luna não pode travar por uma falha nessa verificação.
async function isContactBlocked(conversationId: string, phone: string | null, externalId: string | undefined): Promise<boolean> {
  try {
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
  } catch (error) {
    logConversationError(
      conversationId,
      'erro ao buscar no Zendesk se o contato está bloqueado — deixando passar e assumindo que não está bloqueado',
      error,
    );
    return false;
  }
}

// Palavras-chave que, quando a mensagem do cliente é exatamente igual (sem variação), pulam a
// Luna e vão direto pro humano — Isso para as mensagens ativas e o usuário clica num botão ou mensagens ativas do time de social
const BYPASS_AGENT_KEYWORDS = ['Vamos!', 'Preciso de suporte!', 'Vamos falar!', 'Pode trocar o ingresso!', 'Prefiro o cancelamento!', 'Sim, tenho o ingresso!', 'Não tenho mais!'];

function isMessageKeywordToBypassAgent(message: string): boolean {
  return BYPASS_AGENT_KEYWORDS.includes(message);
}
