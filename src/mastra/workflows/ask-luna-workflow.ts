import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { Luna } from '../agents/luna/luna';
import { guardrailActionSchema } from '../agents/luna/luna-agent';
import { logConversation } from './helpers/logger';
import { resolveBusinessByAppId } from '../business/registry';
import { GuardrailDecision } from './helpers/guardrail-decision';

// Foco no Zendesk, simples: quem chama esse workflow (webhooks/zendesk/prepare-ask-luna-call.ts)
// já resolveu empresa/bloqueio/estado da conversa/mídia antes — aqui só sobra o essencial:
// 1. recebe a mensagem já pronta pra Luna
// 2. manda pro agente
// 3. decide responder e/ou conectar com base na resposta do agente (guardrail) — uma branch
//    de verdade, um caminho por ação possível: mandar a resposta pro Zendesk e, se for o caso,
//    fazer o handoff pro time humano (aviso de negócio + switchboard, ver `Business`).

const askLunaInputSchema = z.object({
  appId: z.string(),
  conversationId: z.string(),
  resourceId: z.string(),
  userPhone: z.string().nullable(),
  message: z.string(),
});

const guardrailResultSchema = askLunaInputSchema.extend({
  action: guardrailActionSchema,
  answer: z.string().optional(),
});

const outcomeSchema = z.object({
  conversationId: z.string(),
  outcome: z.enum(['replied', 'connected_human', 'replied_and_connected_human']),
});

function businessFor(inputData: { appId: string }) {
  return resolveBusinessByAppId(inputData.appId);
}

const askLunaStep = createStep({
  id: 'ask-luna',
  inputSchema: askLunaInputSchema,
  outputSchema: guardrailResultSchema,
  execute: async ({ inputData }) => {
    const { conversationId, resourceId, userPhone, message } = inputData;

    const { answer, guardrail } = await Luna.ask(message, {
      memory: { thread: conversationId, resource: resourceId },
      requestContext: userPhone ? { user_phone: userPhone } : {},
    });

    const action = guardrail?.action ?? 'reply';
    logConversation(conversationId, `resposta recebida da Luna (guardrail: ${action}): ${answer}`);

    return { ...inputData, action, answer: answer ?? undefined };
  },
});

// Manda a resposta da Luna pro cliente via Zendesk.
const sendReplyStep = createStep({
  id: 'send-reply',
  inputSchema: guardrailResultSchema,
  outputSchema: guardrailResultSchema,
  execute: async ({ inputData }) => {
    if (inputData.answer) {
      await businessFor(inputData).channel.sendMessage(inputData.conversationId, inputData.answer);
    }
    return inputData;
  },
});

// Decide se a conversa vai (ou não) pro time humano e, quando vai, faz o handoff completo:
// aviso de negócio (horário/volume) + passagem de switchboard, ver `Business.handoffToHuman`.
const connectToHumanStep = createStep({
  id: 'connect-to-human',
  inputSchema: guardrailResultSchema,
  outputSchema: outcomeSchema,
  execute: async ({ inputData }) => {
    const decide = GuardrailDecision<{ outcome: z.infer<typeof outcomeSchema>['outcome']; connectHuman: boolean }>({
      onReply: () => ({ outcome: 'replied', connectHuman: false }),
      onConnectHuman: () => ({ outcome: 'connected_human', connectHuman: true }),
      onReplyAndConnect: () => ({ outcome: 'replied_and_connected_human', connectHuman: true }),
    });
    const { outcome, connectHuman } = decide(inputData.action);

    if (connectHuman) {
      await businessFor(inputData).handoffToHuman(inputData.conversationId);
    }
    return { conversationId: inputData.conversationId, outcome };
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
