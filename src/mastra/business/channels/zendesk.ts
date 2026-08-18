import { ZendeskTicket, type ZendeskSwitchboards } from '../../webhooks/zendesk/zendesk-client';
import type { Channel } from '../channel';

export interface ZendeskChannelConfig {
  // `app.id` do webhook do Zendesk (Sunshine Conversations) — é o que liga um evento recebido
  // a esta empresa no `business/registry.ts`. `undefined` até `ZENDESK_APP_ID` ser configurado.
  appId: string | undefined;
  switchboards: ZendeskSwitchboards;
}

// Canal Zendesk de uma empresa: mesma API do `Channel`, com a conversa (`conversationId`) e os
// switchboards resolvidos por chamada, sem guardar estado. Detalhes de mensageria/handoff do
// Zendesk (`ZendeskTicket`) ficam escondidos atrás desta interface.
export function Zendesk(config: ZendeskChannelConfig): Channel {
  function ticketFor(conversationId: string) {
    if (!config.appId) {
      throw new Error('Zendesk channel is missing appId — set ZENDESK_APP_ID for this business.');
    }
    return ZendeskTicket(config.appId, conversationId, config.switchboards);
  }

  async function sendMessage(conversationId: string, text: string): Promise<void> {
    await ticketFor(conversationId).sendMessage(text);
  }

  async function connectHuman(conversationId: string): Promise<void> {
    await ticketFor(conversationId).connectHuman();
  }

  return { appId: config.appId, sendMessage, connectHuman };
}
