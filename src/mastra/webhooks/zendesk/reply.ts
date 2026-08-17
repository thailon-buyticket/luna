import { env } from '../../config/env';
import { requireEnv } from '../../config/require-env';
import { zendeskConversationsRequest } from '../../services/zendesk';
import { getHandoffNoticeMessage } from './business-hours';

const BUSINESS_AUTHOR = {
  type: 'business',
  displayName: 'Suporte BuyTicket - Luna',
  avatarUrl: 'https://buyticket.zendesk.com/flow_composer/assets/bot-avatar/01J6ZVKVXSQC3TN0QC4SNQJ12W',
};

export async function sendMessageToUserZendesk(appId: string, conversationId: string, text: string): Promise<void> {
  await zendeskConversationsRequest(appId, `conversations/${conversationId}/messages`, {
    method: 'POST',
    body: {
      author: BUSINESS_AUTHOR,
      content: { type: 'text', text },
    },
  });
}

export async function handoffChatToHumanZendeskSwitchboard(appId: string, conversationId: string): Promise<void> {
  const { ZENDESK_HUMAN_SWITCHBOARD_ID } = requireEnv(
    { ZENDESK_HUMAN_SWITCHBOARD_ID: env.ZENDESK_HUMAN_SWITCHBOARD_ID },
    'Zendesk human handoff',
  );

  const notice = getHandoffNoticeMessage();
  if (notice) {
    await sendMessageToUserZendesk(appId, conversationId, notice);
  }

  await zendeskConversationsRequest(appId, `conversations/${conversationId}/passControl`, {
    method: 'POST',
    body: { switchboardIntegration: ZENDESK_HUMAN_SWITCHBOARD_ID, metadata: { lang: 'pt-br' } },
  });
}
