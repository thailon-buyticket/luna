// Superfície pública deste módulo: o schema de entrada do webhook. A orquestração (bloqueio,
// roteamento de mídia, chamada da Luna, decisão do guardrail) vive no workflow `ask-luna`
// (src/mastra/workflows/ask-luna-workflow.ts), que importa os outros arquivos deste diretório
// como peças reutilizáveis (attachment-router, blocklist, conversation-state, normalize, reply).
export { conversationMessageSchema, zendeskWebhookSchema } from './schema';
