import { env } from '../../config/env';
import { requireEnv } from '../../config/require-env';
import { zendeskConversationsRequest } from '../../services/zendesk';

export interface ZendeskTicket {
  appId: string;
  conversationId: string;
}

const BUSINESS_AUTHOR = {
  type: 'business',
  displayName: 'Suporte BuyTicket - Luna',
  avatarUrl: 'https://buyticket.zendesk.com/flow_composer/assets/bot-avatar/01J6ZVKVXSQC3TN0QC4SNQJ12W',
};

// Blocos básicos de ação no Zendesk. O resto do código (workflow, prepare-ask-luna-call)
// compõe esses blocos em vez de falar direto com a Conversations API.
export const Zendesk = {
  async sendMessage(ticket: ZendeskTicket, text: string): Promise<void> {
    await zendeskConversationsRequest(ticket.appId, `conversations/${ticket.conversationId}/messages`, {
      method: 'POST',
      body: {
        author: BUSINESS_AUTHOR,
        content: { type: 'text', text },
      },
    });
  },

  async connectHuman(ticket: ZendeskTicket): Promise<void> {
    const { ZENDESK_HUMAN_SWITCHBOARD_ID } = requireEnv(
      { ZENDESK_HUMAN_SWITCHBOARD_ID: env.ZENDESK_HUMAN_SWITCHBOARD_ID },
      'Zendesk human handoff',
    );

    await zendeskConversationsRequest(ticket.appId, `conversations/${ticket.conversationId}/passControl`, {
      method: 'POST',
      body: { switchboardIntegration: ZENDESK_HUMAN_SWITCHBOARD_ID, metadata: { lang: 'pt-br' } },
    });
  },
};
