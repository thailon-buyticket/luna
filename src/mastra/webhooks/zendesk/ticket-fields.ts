import type { LunaWorkingMemory } from '../../agents/luna-working-memory/schema';

// IDs dos ticket fields do Zendesk (Sunshine Conversations) usados no `dataCapture.ticketField.<id>`
// do `passControl` (ver `zendesk.ts`) — específicos da instância Zendesk da Buyticket, passados
// pelo time de suporte. Mais campos (motivo_contato etc) ainda serão adicionados aqui.
const TICKET_FIELD_ID_PEDIDO = '34295554044820';
const TICKET_FIELD_CONVERSATION_ID = '49116375748756';

export function buildHandoffTicketFields(conversationId: string, workingMemory: LunaWorkingMemory | null): Record<string, string> {
  const fields: Record<string, string> = {
    [TICKET_FIELD_CONVERSATION_ID]: conversationId,
  };
  if (workingMemory?.id_pedido) {
    fields[TICKET_FIELD_ID_PEDIDO] = workingMemory.id_pedido;
  }
  return fields;
}
