import { RequestContext } from '@mastra/core/request-context';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { luna } from '../agents/luna/luna-agent';
import { extractGuardrailOutput } from '../agents/luna-guardrail/extract-metadata';
import type { GuardrailOutput } from '../agents/luna-guardrail/schema';
import { logConversation } from '../webhooks/zendesk/logger';
import { connectToHumanSwitchboard, sendHandoffNotice, sendMessageToUserZendesk } from '../webhooks/zendesk/reply';

// Foco no Zendesk, simples: quem chama esse workflow (webhooks/zendesk/prepare-ask-luna-call.ts)
// já resolveu empresa/bloqueio/estado da conversa/mídia antes — aqui só sobra o essencial:
// 1. recebe a mensagem já pronta pra Luna
// 2. manda pro agente
// 3. decide responder e/ou conectar com base na resposta do agente (guardrail) — uma branch
//    de verdade, um caminho por ação possível, cada um com os steps visíveis por baixo:
//    mandar a resposta pro Zendesk, mandar o aviso (alto volume/fora do horário) e conectar
//    (ou não) com o switchboard humano.

const askLunaInputSchema = z.object({
  appId: z.string(),
  conversationId: z.string(),
  resourceId: z.string(),
  userPhone: z.string().nullable(),
  message: z.string(),
});

const guardrailResultSchema = askLunaInputSchema.extend({
  action: z.enum(['reply', 'connect_human', 'reply_and_connect_human']),
  answer: z.string().optional(),
});

const outcomeSchema = z.object({
  conversationId: z.string(),
  outcome: z.enum(['replied', 'connected_human', 'replied_and_connected_human']),
});

type GuardrailAction = GuardrailOutput['action'];

function shouldConnectHuman(action: GuardrailAction): boolean {
  return action === 'connect_human' || action === 'reply_and_connect_human';
}

function outcomeForGuardrailAction(action: GuardrailAction): z.infer<typeof outcomeSchema>['outcome'] {
  if (action === 'reply') return 'replied';
  if (action === 'connect_human') return 'connected_human';
  return 'replied_and_connected_human';
}

const askLunaStep = createStep({
  id: 'ask-luna',
  inputSchema: askLunaInputSchema,
  outputSchema: guardrailResultSchema,
  execute: async ({ inputData }) => {
    const { conversationId, resourceId, userPhone, message } = inputData;

    const result = await luna.generate(message, {
      memory: { thread: conversationId, resource: resourceId },
      requestContext: new RequestContext(userPhone ? [['user_phone', userPhone]] : []),
    });

    const action = extractGuardrailOutput(result)?.action ?? 'reply';
    const answer = result.text?.trim();
    logConversation(conversationId, `resposta recebida da Luna (guardrail: ${action}): ${answer}`);

    return { ...inputData, action, answer };
  },
});

// Manda a resposta da Luna pro cliente via Zendesk.
const sendReplyStep = createStep({
  id: 'send-reply',
  inputSchema: guardrailResultSchema,
  outputSchema: guardrailResultSchema,
  execute: async ({ inputData }) => {
    if (inputData.answer) {
      await sendMessageToUserZendesk(inputData.appId, inputData.conversationId, inputData.answer);
    }
    return inputData;
  },
});

// Manda o aviso de alto volume ou fora do horário, antes de transferir pra um humano.
const sendHandoffNoticeStep = createStep({
  id: 'send-handoff-notice',
  inputSchema: guardrailResultSchema,
  outputSchema: guardrailResultSchema,
  execute: async ({ inputData }) => {
    await sendHandoffNotice(inputData.appId, inputData.conversationId);
    return inputData;
  },
});

// Conecta (ou não) a conversa com o switchboard humano, e fecha com o resultado final.
const connectToHumanStep = createStep({
  id: 'connect-to-human',
  inputSchema: guardrailResultSchema,
  outputSchema: outcomeSchema,
  execute: async ({ inputData }) => {
    if (shouldConnectHuman(inputData.action)) {
      await connectToHumanSwitchboard(inputData.appId, inputData.conversationId);
    }
    return { conversationId: inputData.conversationId, outcome: outcomeForGuardrailAction(inputData.action) };
  },
});

const replyOnlyWorkflow = createWorkflow({
  id: 'reply-only',
  inputSchema: guardrailResultSchema,
  outputSchema: outcomeSchema,
})
  .then(sendReplyStep)
  .then(connectToHumanStep)
  .commit();

const connectOnlyWorkflow = createWorkflow({
  id: 'connect-only',
  inputSchema: guardrailResultSchema,
  outputSchema: outcomeSchema,
})
  .then(sendHandoffNoticeStep)
  .then(connectToHumanStep)
  .commit();

// Em reply_and_connect_human a ordem importa: primeiro a resposta chega pro cliente, só
// depois o aviso e a transferência pro humano.
const replyAndConnectWorkflow = createWorkflow({
  id: 'reply-and-connect',
  inputSchema: guardrailResultSchema,
  outputSchema: outcomeSchema,
})
  .then(sendReplyStep)
  .then(sendHandoffNoticeStep)
  .then(connectToHumanStep)
  .commit();

export const askLunaWorkflow = createWorkflow({
  id: 'ask-luna',
  description:
    'Manda a mensagem do cliente pra Luna e aplica a decisão do guardrail: responde e/ou transfere a ' +
    'conversa pra um humano (com o aviso de alto volume ou fora do horário, conforme o caso).',
  inputSchema: askLunaInputSchema,
  outputSchema: outcomeSchema,
})
  .then(askLunaStep)
  .branch([
    [async ({ inputData }) => inputData.action === 'reply', replyOnlyWorkflow],
    [async ({ inputData }) => inputData.action === 'connect_human', connectOnlyWorkflow],
    [async ({ inputData }) => inputData.action === 'reply_and_connect_human', replyAndConnectWorkflow],
  ])
  .map(async ({ inputData }) => inputData['reply-only'] ?? inputData['connect-only'] ?? inputData['reply-and-connect'])
  .commit();
