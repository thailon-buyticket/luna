// Superfície pública deste módulo: o schema de entrada do webhook. A orquestração (bloqueio,
// roteamento de mídia, chamada da Luna, decisão do guardrail) vive no workflow `ask-luna`
// (src/mastra/workflows/ask-luna-workflow.ts), que importa os outros arquivos deste diretório
// como peças reutilizáveis (attachment-router, blocklist, conversation-state, normalize,
// zendesk-client). As regras de negócio da BuyTicket (horário, volume, aviso de handoff) ficam
// isoladas em `business/buyticket.ts`, sem depender do Zendesk.



export { conversationMessageSchema, zendeskWebhookSchema } from './schema';
