// Superfície pública deste módulo: o resto do app só precisa conhecer o schema de entrada
// e o entrypoint do handler — toda a orquestração interna (buffer, bloqueio, roteamento de
// mídia, pipeline da Luna, mensagens de handoff) fica encapsulada nos arquivos deste diretório.
export { conversationMessageSchema, zendeskWebhookSchema } from './schema';
export { handleConversationMessage } from './handler';
