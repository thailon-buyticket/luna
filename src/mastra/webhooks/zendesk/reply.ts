import { getHandoffNoticeMessage } from './business-hours';
import { Zendesk, type ZendeskTicket } from './zendesk-client';

// Composições dos blocos do Zendesk pra quem lida com o handoff fora do workflow (ex.:
// prepare-ask-luna-call.ts), onde decidir o aviso e conectar sempre acontecem juntos.
export async function sendHandoffNotice(ticket: ZendeskTicket): Promise<void> {
  const notice = getHandoffNoticeMessage();
  if (notice) {
    await Zendesk.sendMessage(ticket, notice);
  }
}

export async function handoffChatToHumanZendeskSwitchboard(ticket: ZendeskTicket): Promise<void> {
  await sendHandoffNotice(ticket);
  await Zendesk.connectHuman(ticket);
}
