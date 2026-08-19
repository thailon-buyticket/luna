import { mastra } from '../mastra-instance';

// Import circular com `../mastra-instance` de propósito: os logs de conversa vêm de código que roda fora
// do contexto de um agent/tool/workflow (rotas de webhook, timers de buffer), então é preciso
// buscar o logger configurado no Mastra em vez de receber ele por parâmetro. Como só é acessado
// dentro das funções abaixo (nunca no topo do módulo), o binding do ESM já está resolvido a
// tempo de qualquer chamada real.
function getLogger() {
  return mastra.getLogger();
}

export function logConversation(conversationId: string, message: string): void {
  getLogger().info(`[conversa ${conversationId}] ${message}`);
}

export function logConversationError(conversationId: string, message: string, error: unknown): void {
  getLogger().error(`[conversa ${conversationId}] ${message}`, { error });
}
