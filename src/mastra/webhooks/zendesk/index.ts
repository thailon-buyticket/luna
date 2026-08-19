// Superfície pública deste módulo: o schema de entrada do webhook. Todo o fluxo — preparar a
// mensagem (bloqueio, mídia normalizada pra texto), buffer e chamada à Luna — vive num único
// lugar: `routes/zendesk-webhook.ts`. As regras de negócio da BuyTicket (horário, volume, aviso
// de handoff) ficam isoladas em `business/buyticket.ts`, sem depender do Zendesk.

export { conversationMessageSchema, zendeskWebhookSchema } from './schema';
