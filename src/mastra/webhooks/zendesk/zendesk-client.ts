import { requireEnv } from '../../config/require-env';
import { zendeskConversationsRequest } from '../../services/zendesk';
import type { ZendeskConversationMessagePayload, ZendeskMessage } from './schema';

export type SwitchboardTarget = 'human' | 'ai_agent';

// IDs configurados no Zendesk (Sunshine Conversations) que identificam pra onde a conversa vai
// ao trocar de switchboard. Vêm da empresa dona do canal (ver `business/channels/zendesk.ts`),
// não de env global — cada empresa tem os seus.
export type ZendeskSwitchboards = Record<SwitchboardTarget, string | undefined>;

const BUSINESS_AUTHOR = {
  type: 'business',
  displayName: 'Suporte BuyTicket - Luna',
  avatarUrl: 'https://buyticket.zendesk.com/flow_composer/assets/bot-avatar/01J6ZVKVXSQC3TN0QC4SNQJ12W',
};

export interface ZendeskTicket {
  appId: string;
  conversationId: string;
  sendMessage(text: string): Promise<void>;
  passSwitchboardTo(target: SwitchboardTarget): Promise<void>;
  connectHuman(): Promise<void>;
}

// Uma conversa do Zendesk já amarrada ao app/conversationId certos — quem chama pede o ticket
// uma vez e usa os métodos dele, em vez de carregar {appId, conversationId} em toda função.
// Mecânica pura do Zendesk: nenhuma regra de negócio (horário, aviso de handoff) mora aqui —
// isso é responsabilidade do `Business` dono do canal (ver `business/business-factory.ts`).
export function ZendeskTicket(appId: string, conversationId: string, switchboards: ZendeskSwitchboards): ZendeskTicket {
  async function sendMessage(text: string): Promise<void> {
    await zendeskConversationsRequest(appId, `conversations/${conversationId}/messages`, {
      method: 'POST',
      body: {
        author: BUSINESS_AUTHOR,
        content: { type: 'text', text },
      },
    });
  }

  async function passSwitchboardTo(target: SwitchboardTarget): Promise<void> {
    const switchboardId = requireEnv(
      { [target]: switchboards[target] } as Record<string, string | undefined>,
      `Zendesk switchboard (${target})`,
    )[target];

    await zendeskConversationsRequest(appId, `conversations/${conversationId}/passControl`, {
      method: 'POST',
      body: { switchboardIntegration: switchboardId, metadata: { lang: 'pt-br' } },
    });
  }

  async function connectHuman(): Promise<void> {
    await passSwitchboardTo('human');
  }

  return { appId, conversationId, sendMessage, passSwitchboardTo, connectHuman };
}

export interface NormalizedZendeskMessage {
  appId: string;
  conversationId: string;
  messageId: string;
  userId: string | undefined;
  userName: string | undefined;
  userMessage: string;
  userPhone: string | null;
  externalId: string | undefined;
  messageType: string;
  messageTimestamp: string;
  isFromCompany: boolean;
}

export function normalizeIncomingMessage(
  appId: string,
  { conversation, message }: ZendeskConversationMessagePayload,
): NormalizedZendeskMessage {
  return {
    appId,
    conversationId: conversation.id,
    messageId: message.id,
    userId: message.author.userId,
    userName: message.author.displayName,
    userMessage: message.content.text ?? '',
    userPhone: resolveUserPhone(message),
    externalId: message.source?.client?.externalId,
    messageType: message.content.type,
    messageTimestamp: message.received,
    isFromCompany: message.author.type === 'business',
  };
}

function resolveUserPhone(message: ZendeskMessage): string | null {
  return message.source?.client?.additionalIdentifiers?.[0]?.value ?? message.source?.client?.raw?.from ?? null;
}

